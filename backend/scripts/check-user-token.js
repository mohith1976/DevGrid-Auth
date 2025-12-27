#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/check-user-token.js <userId>');
    process.exit(2);
  }
  const userId = args[0];
  const prisma = new PrismaClient();
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { githubAccessToken: true, username: true } });
    if (!dbUser) { console.error('DB user not found'); process.exit(3); }
    if (!dbUser.githubAccessToken) { console.error('No githubAccessToken for user'); process.exit(4); }
    const token = String(dbUser.githubAccessToken);
    console.log('Found token for user', dbUser.username || userId, '— calling GitHub /user');
    const res = await axios.get('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'DevGrid-Check' }, validateStatus: () => true });
    console.log('GitHub API status:', res.status);
    if (res.status === 200 && res.data) {
      console.log('login:', res.data.login, 'public_repos:', res.data.public_repos, 'name:', res.data.name || '');
    } else {
      console.log('GitHub body:', res.data);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
