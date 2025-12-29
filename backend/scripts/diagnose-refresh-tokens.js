#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { createDecipheriv, randomBytes, createHash } = require('crypto');

const prisma = new PrismaClient();
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) { console.error('ENCRYPTION_KEY not set'); process.exit(2); }
const KEY = Buffer.from(ENCRYPTION_KEY, 'base64');
if (KEY.length !== 32) { console.error('ENCRYPTION_KEY must be base64 of 32 bytes'); process.exit(2); }

function decryptPayload(payload) {
  try {
    const [ivB64, encryptedB64, tagB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return { ok: true, plain: decrypted.toString('utf8') };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

(async function(){
  try {
    const users = await prisma.user.findMany({ where: { githubRefreshToken: { not: null } }, select: { id: true, username: true, githubRefreshToken: true } });
    console.log('Found', users.length, 'users with refresh tokens');
    for (const u of users) {
      console.log('\n---');
      console.log('user:', u.username, 'id:', u.id);
      let dec = { ok: false };
      try {
        dec = decryptPayload(String(u.githubRefreshToken));
      } catch (e) { dec = { ok: false, error: e?.message || e }; }
      if (!dec.ok) {
        console.log('  decrypt: FAILED -', dec.error);
        continue;
      }
      const plain = dec.plain;
      const len = Buffer.byteLength(plain, 'utf8');
      const hash = createHash('sha256').update(plain).digest('hex').slice(0, 16);
      console.log('  decrypt: OK, length=', len, 'sha256-prefix=', hash);

      // Attempt direct refresh
      try {
        const tokenUrl = 'https://github.com/login/oauth/access_token';
        const body = new URLSearchParams();
        body.set('grant_type', 'refresh_token');
        body.set('refresh_token', plain);
        if (process.env.GITHUB_CLIENT_ID) body.set('client_id', process.env.GITHUB_CLIENT_ID);
        if (process.env.GITHUB_CLIENT_SECRET) body.set('client_secret', process.env.GITHUB_CLIENT_SECRET);
        const res = await axios.post(tokenUrl, body.toString(), { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, validateStatus: () => true });
        console.log('  refresh HTTP status:', res.status);
        const data = res.data || {};
        console.log('  response keys:', Object.keys(data));
        if (data.error || data.error_description) console.log('  error:', data.error, 'description:', data.error_description);
        if (data.access_token) console.log('  refresh succeeded: access_token present, expires_in=', data.expires_in || '(unknown)');
      } catch (e) {
        console.log('  refresh request failed:', e?.message || e);
      }
    }
  } catch (e) {
    console.error('Error', e);
  } finally {
    await prisma.$disconnect();
  }
})();
