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
    const token = dbUser && dbUser.githubAccessToken ? String(dbUser.githubAccessToken) : undefined;
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
    const key = `stats:svg:demo:${String(username).toLowerCase()}:default`;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="560" height="240">` +
      `<text x="20" y="30" font-weight="700">DevGrid Stats</text>` +
      `<text x="20" y="56" fill="#0a66c2">${username}</text>` +
      `<text x="80" y="120" font-size="34" font-weight="700">${stats.stars}</text>` +
      `<text x="260" y="120" font-size="34" font-weight="700">${stats.publicRepos}</text>` +
      `<text x="440" y="120" font-size="34" font-weight="700">${stats.prs}</text>` +
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
