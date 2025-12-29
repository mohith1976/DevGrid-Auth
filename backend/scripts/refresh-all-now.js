#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient, Prisma } = require('@prisma/client');
const axios = require('axios');
const { randomBytes, createCipheriv, createDecipheriv } = require('crypto');

const prisma = new PrismaClient();
const IV_LEN = 12;
const ALGO = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) { console.error('ENCRYPTION_KEY not set'); process.exit(2); }
const KEY = Buffer.from(ENCRYPTION_KEY, 'base64');
if (KEY.length !== 32) { console.error('ENCRYPTION_KEY must be base64 of 32 bytes'); process.exit(2); }

function decryptPayload(payload) {
  const [ivB64, encryptedB64, tagB64] = payload.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function encryptPayload(plain) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

async function refreshTokenForUser(user) {
  if (!user.githubRefreshToken) return false;
  try {
    const refreshPlain = decryptPayload(String(user.githubRefreshToken));
    const tokenUrl = 'https://github.com/login/oauth/access_token';
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshPlain);
    if (process.env.GITHUB_CLIENT_ID) body.set('client_id', process.env.GITHUB_CLIENT_ID);
    if (process.env.GITHUB_CLIENT_SECRET) body.set('client_secret', process.env.GITHUB_CLIENT_SECRET);
    const res = await axios.post(tokenUrl, body.toString(), { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res) throw new Error('Empty refresh response');
    const tokenRes = res.data || {};
    console.log('Refresh HTTP status', res.status, 'for', user.username, 'response keys:', Object.keys(tokenRes));
    if (tokenRes.error || tokenRes.error_description) console.log('  error:', tokenRes.error, 'description:', tokenRes.error_description);
    const newAccess = tokenRes.access_token ?? tokenRes.accessToken ?? null;
    const newRefresh = tokenRes.refresh_token ?? tokenRes.refreshToken ?? null;
    const expiresIn = Number(tokenRes.expires_in ?? tokenRes.expires ?? 0);
    const refreshExpiresIn = Number(tokenRes.refresh_token_expires_in ?? tokenRes.refresh_expires_in ?? 0);
    if (!newAccess) throw new Error('No access_token in refresh response');
    const encryptedAccess = encryptPayload(newAccess);
    const update = { githubAccessToken: encryptedAccess, githubTokenValid: true };
    if (expiresIn && expiresIn > 0) update.githubAccessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    if (newRefresh) update.githubRefreshToken = encryptPayload(newRefresh);
    if (refreshExpiresIn && refreshExpiresIn > 0) update.githubRefreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    const parts = [];
    if (update.githubAccessToken !== undefined) parts.push(Prisma.sql`"githubAccessToken" = ${update.githubAccessToken}`);
    if (update.githubAccessTokenExpiresAt !== undefined) parts.push(Prisma.sql`"githubAccessTokenExpiresAt" = ${update.githubAccessTokenExpiresAt}`);
    if (update.githubRefreshToken !== undefined) parts.push(Prisma.sql`"githubRefreshToken" = ${update.githubRefreshToken}`);
    if (update.githubRefreshTokenExpiresAt !== undefined) parts.push(Prisma.sql`"githubRefreshTokenExpiresAt" = ${update.githubRefreshTokenExpiresAt}`);
    if (update.githubTokenValid !== undefined) parts.push(Prisma.sql`"githubTokenValid" = ${update.githubTokenValid}`);
    if (parts.length > 0) {
      const sql = Prisma.sql`UPDATE "User" SET ${Prisma.join(parts, Prisma.sql`, `)} WHERE id = ${user.id}`;
      console.log('DEBUG SQL TEXT:', sql.text);
      console.log('DEBUG SQL VALUES:', sql.values);
      await prisma.$executeRawUnsafe(sql.text, ...(sql.values || []));
    }
    console.log('Refreshed tokens for user', user.username);
    return true;
  } catch (e) {
    console.warn('Failed to refresh for', user.username, 'status/message:', e?.message || e);
    try { const _sql = Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${false} WHERE id = ${user.id}`; await prisma.$executeRawUnsafe(_sql.text, ...(_sql.values || [])); } catch (_) {}
    return false;
  }
}

async function verifyTokenForUser(user) {
  try {
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { githubAccessToken: true } });
    if (!fresh || !fresh.githubAccessToken) {
      console.log('No access token to verify for', user.username);
      return false;
    }
    let token;
    try { token = decryptPayload(String(fresh.githubAccessToken)); } catch (e) { token = undefined; }
    if (!token) { console.log('Unable to decrypt access token for', user.username); return false; }
    const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'DevGrid-TokenCheck', Authorization: `Bearer ${token}` };
    const res = await axios.get('https://api.github.com/user', { headers, validateStatus: () => true });
    if (res.status === 200) {
      console.log('Token verified for', user.username);
      try { const _sql_ok = Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${true} WHERE id = ${user.id}`; await prisma.$executeRawUnsafe(_sql_ok.text, ...(_sql_ok.values || [])); } catch (_) {}
      return true;
    }
    console.warn('Token verification failed for', user.username, 'status', res.status);
    try { const _sql_fail = Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${false} WHERE id = ${user.id}`; await prisma.$executeRawUnsafe(_sql_fail.text, ...(_sql_fail.values || [])); } catch (_) {}
    return false;
  } catch (e) {
    console.warn('verifyTokenForUser error for', user.username, e?.message || e);
    try { const _sql_err = Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${false} WHERE id = ${user.id}`; await prisma.$executeRawUnsafe(_sql_err.text, ...(_sql_err.values || [])); } catch (_) {}
    return false;
  }
}

(async function(){
  try {
    const users = await prisma.user.findMany({ where: { githubRefreshToken: { not: null } }, select: { id: true, username: true, githubRefreshToken: true, githubAccessTokenExpiresAt: true } });
    console.log('Attempting refresh for', users.length, 'users with refresh tokens');
    for (const u of users) {
      console.log('---', u.username, 'expiresAt=', u.githubAccessTokenExpiresAt);
      const refreshed = await refreshTokenForUser(u);
      if (refreshed) await verifyTokenForUser(u);
    }
  } catch (e) {
    console.error('Error', e);
  } finally {
    await prisma.$disconnect();
  }
})();
