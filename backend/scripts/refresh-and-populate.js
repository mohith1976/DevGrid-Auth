#!/usr/bin/env node
// Refresh GitHub access tokens for users nearing expiry and populate Redis cache for their stats.
// Usage: node scripts/refresh-and-populate.js [threshold_seconds]
// Example: node scripts/refresh-and-populate.js 3600

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { PrismaClient, Prisma } = require('@prisma/client');
// Redis/cache population removed for now; focus on token refresh and verification
const axios = require('axios');
const { randomBytes, createCipheriv, createDecipheriv } = require('crypto');

const prisma = new PrismaClient();
// no redis instance required in this simplified script

const THRESHOLD_SECONDS = Number(process.argv[2] || process.env.REFRESH_THRESHOLD_SEC || '3600'); // default 1 hour
const IV_LEN = 12;
const ALGO = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY not set');
  process.exit(2);
}
const KEY = Buffer.from(ENCRYPTION_KEY, 'base64');
if (KEY.length !== 32) {
  console.error('ENCRYPTION_KEY must be base64 of 32 bytes');
  process.exit(2);
}

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
    if (!res || !res.data) throw new Error('Empty refresh response');
    const tokenRes = res.data;
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

    // Use Prisma.sql fragments for safe parameter binding
    const parts = [];
    if (update.githubAccessToken !== undefined) parts.push(Prisma.sql`"githubAccessToken" = ${update.githubAccessToken}`);
    if (update.githubAccessTokenExpiresAt !== undefined) parts.push(Prisma.sql`"githubAccessTokenExpiresAt" = ${update.githubAccessTokenExpiresAt}`);
    if (update.githubRefreshToken !== undefined) parts.push(Prisma.sql`"githubRefreshToken" = ${update.githubRefreshToken}`);
    if (update.githubRefreshTokenExpiresAt !== undefined) parts.push(Prisma.sql`"githubRefreshTokenExpiresAt" = ${update.githubRefreshTokenExpiresAt}`);
    if (update.githubTokenValid !== undefined) parts.push(Prisma.sql`"githubTokenValid" = ${update.githubTokenValid}`);
    if (parts.length > 0) {
      const sql = Prisma.sql`UPDATE "User" SET ${Prisma.join(parts, Prisma.sql`, `)} WHERE id = ${user.id}`;
      await prisma.$executeRaw(sql);
    }
    console.log('Refreshed tokens for user', user.username);
    return true;
  } catch (e) {
    console.warn('Failed to refresh for', user.username, 'status/message:', e?.message || e);
    // mark invalid (use prisma.sql for safe binding)
    try { await prisma.$executeRaw(Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${false} WHERE id = ${user.id}`); } catch (_) {}
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
      try { await prisma.$executeRaw(Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${true} WHERE id = ${user.id}`); } catch (_) {}
      return true;
    }
    console.warn('Token verification failed for', user.username, 'status', res.status);
    try { await prisma.$executeRaw(Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${false} WHERE id = ${user.id}`); } catch (_) {}
    return false;
  } catch (e) {
    console.warn('verifyTokenForUser error for', user.username, e?.message || e);
    try { await prisma.$executeRaw(Prisma.sql`UPDATE "User" SET "githubTokenValid" = ${false} WHERE id = ${user.id}`); } catch (_) {}
    return false;
  }
}

async function main() {
  try {
    const now = new Date();
    const cutoff = new Date(Date.now() + THRESHOLD_SECONDS * 1000);
    // select users with refresh token and token valid true and access token expiring before cutoff
    const users = await prisma.user.findMany({ where: { githubRefreshToken: { not: null }, githubTokenValid: true }, select: { id: true, username: true, githubAccessToken: true, githubRefreshToken: true, githubAccessTokenExpiresAt: true } });
    console.log('Found', users.length, 'users with refresh tokens, checking expiries...');
    for (const u of users) {
      const exp = u.githubAccessTokenExpiresAt ? new Date(u.githubAccessTokenExpiresAt) : null;
      if (!exp || exp < cutoff) {
        console.log('Refreshing for', u.username);
        const refreshed = await refreshTokenForUser(u);
        if (refreshed) await verifyTokenForUser(u);
      }
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Error', e);
    try { await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
}

main();
