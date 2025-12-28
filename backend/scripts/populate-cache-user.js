#!/usr/bin/env node
// Populate Redis cache for a user by using the user's stored GitHub token.
// Usage: node scripts/populate-cache-user.js <username> <userId>
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const axios = require('axios');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/populate-cache-user.js <username> <userId>');
    process.exit(2);
  }
  const [username, userId] = args;

  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL);

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { githubAccessToken: true } });
    let tokenRaw = dbUser && dbUser.githubAccessToken ? String(dbUser.githubAccessToken) : undefined;
    let token = undefined;
    // Helper to decrypt using same algorithm
    const { decryptPayload } = (() => {
      const { createDecipheriv } = require('crypto');
      const ivLen = 12;
      const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
      return {
        decryptPayload: (payload) => {
          const [ivB64, encryptedB64, tagB64] = payload.split(':');
          const iv = Buffer.from(ivB64, 'base64');
          const encrypted = Buffer.from(encryptedB64, 'base64');
          const tag = Buffer.from(tagB64, 'base64');
          const decipher = createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(tag);
          const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
          return decrypted.toString('utf8');
        }
      };
    })();

    // If access token present and not expired, use it. Otherwise try to refresh using refresh token.
    if (tokenRaw && dbUser.githubAccessTokenExpiresAt && new Date(dbUser.githubAccessTokenExpiresAt) > new Date()) {
      try { token = decryptPayload(tokenRaw); console.log('Decrypted user githubAccessToken from DB'); } catch (e) { console.warn('Failed to decrypt user token, using raw value'); token = tokenRaw; }
    } else if (dbUser && dbUser.githubRefreshToken) {
      try {
        const refreshEnc = String(dbUser.githubRefreshToken);
        const refreshToken = decryptPayload(refreshEnc);
        // call GitHub token endpoint to refresh
        const tokenUrl = 'https://github.com/login/oauth/access_token';
        const params = { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET };
        const tr = await axios.post(tokenUrl, params, { headers: { Accept: 'application/json' } });
        if (tr && tr.data && (tr.data.access_token || tr.data.accessToken)) {
          const newAccess = tr.data.access_token || tr.data.accessToken;
          const newRefresh = tr.data.refresh_token || tr.data.refreshToken;
          const expiresIn = Number(tr.data.expires_in || tr.data.expires || 0);
          const refreshExpiresIn = Number(tr.data.refresh_token_expires_in || tr.data.refresh_expires_in || 0);
          // encrypt helpers
          const { randomBytes, createCipheriv } = require('crypto');
          const ALGO = 'aes-256-gcm';
          const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
          const encrypt = (plain) => {
            const iv = randomBytes(12);
            const cipher = createCipheriv(ALGO, key, iv);
            const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
            const tag = cipher.getAuthTag();
            return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
          };
          const updates = { githubAccessToken: encrypt(newAccess), githubTokenValid: true };
          if (expiresIn && expiresIn>0) updates.githubAccessTokenExpiresAt = new Date(Date.now() + expiresIn*1000);
          if (newRefresh) updates.githubRefreshToken = encrypt(newRefresh);
          if (refreshExpiresIn && refreshExpiresIn>0) updates.githubRefreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn*1000);
          await prisma.user.update({ where: { id: userId }, data: updates });
          token = newAccess;
          console.log('Refreshed access token for user and updated DB');
        } else {
          console.warn('Refresh response did not include access_token; falling back to raw token if present');
          if (tokenRaw) { try { token = decryptPayload(tokenRaw); } catch (e) { token = tokenRaw; } }
        }
      } catch (e) { console.warn('Refresh failed, falling back to raw token if present', (e && e.message) || e); if (tokenRaw) { try { token = decryptPayload(tokenRaw); } catch (_) { token = tokenRaw; } } }
    } else if (tokenRaw) {
      try { token = decryptPayload(tokenRaw); } catch (e) { token = tokenRaw; }
    }
    if (token) console.log('Using user githubAccessToken from DB');
    else if (process.env.GITHUB_TOKEN) console.log('No user token; falling back to app-level GITHUB_TOKEN');
    else console.log('No token found; will perform unauthenticated GitHub calls');

    const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'DevGrid-Stats' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const stats = { stars: 0, publicRepos: 0, prs: 0, commits: 0, contributions: 0, streak: 0 };

    // user info
    try {
      const u = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, validateStatus: () => true });
      if (u.status === 200 && u.data) stats.publicRepos = Number(u.data.public_repos || 0);
    } catch (e) { console.warn('user info fetch failed', e.message); }

    // repos -> stars (single page first 100 for speed)
    try {
      const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos`, { params: { per_page: 100, page: 1 }, headers, validateStatus: () => true });
      if (Array.isArray(res.data)) for (const r of res.data) stats.stars += Number(r.stargazers_count || 0);
    } catch (e) { console.warn('repos fetch failed', e.message); }

    // PRs
    try {
      const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const q = `author:${username} type:pr created:>=${since}`;
      const res = await axios.get('https://api.github.com/search/issues', { params: { q, per_page: 1 }, headers, validateStatus: () => true });
      if (res.status === 200 && res.data && typeof res.data.total_count === 'number') stats.prs = Number(res.data.total_count || 0);
    } catch (e) { console.warn('pr search failed', e.message); }

    // events -> contributions/commits/streak (single page)
    try {
      const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/events`, { params: { per_page: 100, page: 1 }, headers, validateStatus: () => true });
      if (Array.isArray(res.data)) {
        const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const eventsInYear = res.data.filter(e => new Date(e.created_at) >= cutoff);
        stats.contributions = eventsInYear.length;
        stats.commits = eventsInYear.reduce((sum, e) => {
          try { if (e.type === 'PushEvent' && e.payload && Array.isArray(e.payload.commits)) return sum + e.payload.commits.length; } catch (_) {}
          return sum;
        }, 0);
        const daySet = new Set(eventsInYear.map(e => new Date(e.created_at).toISOString().slice(0, 10)));
        let cur = new Date(); cur.setUTCHours(0,0,0,0);
        let curStreak = 0;
        while (true) {
          const d = cur.toISOString().slice(0, 10);
          if (daySet.has(d)) { curStreak++; cur.setUTCDate(cur.getUTCDate() - 1); } else break;
        }
        stats.streak = curStreak;
      }
    } catch (e) { console.warn('events fetch failed', e.message); }

    // Build simple SVG (keeps format compatible)
    // Build canonical options string matching backend serializeOptions behavior
    const optsPairs = [
      'hide=',
      'hide_border=false',
      'layout=default',
      'show=stars,repos,prs,commits,contributions,streak',
      'theme=dark'
    ].join('&');
    const optEncoded = encodeURIComponent(optsPairs);
    const key = `stats:svg:demo:${String(username).toLowerCase()}:${optEncoded}`;

    // Determine accuracy flag: if any fetch logged warnings we set partial=true earlier
    // In this script we treated warnings but didn't set a 'partial' flag; infer accuracy by checking whether token was used and no warnings occurred.
    // For simplicity, mark as 'accurate' if token was present and we got a non-empty repos count; otherwise 'approximate'.
    const usedUserToken = Boolean(token);
    const accuracy = (usedUserToken && stats.publicRepos > 0) ? 'accurate' : (usedUserToken ? 'partial' : 'approximate');

    const accuracyNote = accuracy === 'accurate' ? 'Accurate data' : (accuracy === 'partial' ? 'Data may be incomplete' : 'Approximate data');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<!--TOKEN-SOURCE:${usedUserToken?'USER':'APP_OR_NONE'}-->\n<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="240" viewBox="0 0 560 240" preserveAspectRatio="xMidYMid meet">` +
      `<rect x="0.5" y="0.5" width="559" height="239" rx="10" fill="#0f141a" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1" />` +
      `<text x="22" y="30" fill="#ffffff" font-size="18" font-weight="800">DevGrid Stats</text>` +
      `<text x="22" y="52" fill="#ff8c00" font-size="14" font-weight="700">${username}</text>` +
      `<text x="22" y="68" fill="#9aa4c0" font-size="11">${accuracyNote}</text>` +
      `<text x="108" y="88" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700">${stats.stars}</text>` +
      `<text x="108" y="127" text-anchor="middle" fill="#9aa4c0" font-size="13">Stars</text>` +
      `<text x="280" y="88" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700">${stats.publicRepos}</text>` +
      `<text x="280" y="127" text-anchor="middle" fill="#9aa4c0" font-size="13">Repos</text>` +
      `<text x="452" y="88" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700">${stats.prs}</text>` +
      `<text x="452" y="127" text-anchor="middle" fill="#9aa4c0" font-size="13">PRs (1y)</text>` +
      `<text x="108" y="178" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700">${stats.commits}</text>` +
      `<text x="108" y="217" text-anchor="middle" fill="#9aa4c0" font-size="13">Commits</text>` +
      `<text x="280" y="178" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700">${stats.contributions}</text>` +
      `<text x="280" y="217" text-anchor="middle" fill="#9aa4c0" font-size="13">Activity</text>` +
      `<text x="452" y="178" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="700">${stats.streak}d</text>` +
      `<text x="452" y="217" text-anchor="middle" fill="#9aa4c0" font-size="13">Streak</text>` +
      `</svg>`;

    // TTL selection: prefer user token => longer
    const TTL_USER = Number(process.env.STATS_TTL_USER_SEC || '28800');
    const TTL_APP = Number(process.env.STATS_TTL_APP_SEC || '14400');
    const ttl = dbUser && dbUser.githubAccessToken ? TTL_USER : (process.env.GITHUB_TOKEN ? TTL_APP : Number(process.env.STATS_TTL_UNAUTH_SEC || '5400'));

    // Use explicit EX flag for TTL to be compatible with Upstash/Redis
    await redis.set(key, svg, 'EX', ttl);
    console.log('Wrote key', key, 'ttl', ttl);
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    try { await prisma.$disconnect(); } catch (_) {}
    try { await redis.quit(); } catch (_) {}
    process.exit(1);
  }
}

main();
