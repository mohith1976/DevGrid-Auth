#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

function decryptPayload(payload) {
  const [ivB64, encryptedB64, tagB64] = payload.split(':');
  if (!ivB64 || !encryptedB64 || !tagB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function parseRepo(input) {
  try {
    if (input.startsWith('http')) {
      const u = new URL(input);
      const parts = u.pathname.split('/').filter(Boolean);
      return { owner: parts[0], repo: parts[1] };
    }
    const [owner, repo] = input.split('/');
    return { owner, repo };
  } catch (e) { return null; }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/check_repo.js <github-username> <owner/repo or repo-url>');
    process.exit(1);
  }
  const [username, repoInput] = args;
  const repoParts = parseRepo(repoInput);
  if (!repoParts || !repoParts.owner || !repoParts.repo) {
    console.error('Invalid repo input. Provide owner/repo or full GitHub URL.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error('No Postgres user found with username', username);
      process.exit(1);
    }
    if (!user.githubAccessToken) {
      console.error('User has no stored GitHub token (githubAccessToken empty)');
      process.exit(1);
    }
    let token;
    try {
      token = decryptPayload(user.githubAccessToken);
    } catch (e) {
      console.error('Failed to decrypt token:', e.message);
      process.exit(1);
    }

    const repoApi = `https://api.github.com/repos/${repoParts.owner}/${repoParts.repo}`;
    console.log('Calling GitHub API:', repoApi);
    try {
      const res = await axios.get(repoApi, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }, validateStatus: ()=>true });
      console.log('Status:', res.status);
      console.log('Rate limit remaining:', res.headers['x-ratelimit-remaining']);
      if (res.status !== 200) {
        console.log('Body:', res.data);
        process.exit(1);
      }
      console.log('Repository found. Name:', res.data.full_name);
      // languages
      const langs = await axios.get(`${repoApi}/languages`, { headers: { Authorization: `token ${token}` }, validateStatus: ()=>true });
      console.log('Languages:', langs.data);
    } catch (e) {
      console.error('GitHub API call failed', e.message);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
