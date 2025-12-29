#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, githubRefreshToken: true, githubAccessToken: true, githubAccessTokenExpiresAt: true, githubTokenValid: true } });
    console.log('Total users:', users.length);
    for (const u of users) {
      console.log('---');
      console.log('id:', u.id);
      console.log('username:', u.username);
      console.log('githubRefreshToken:', u.githubRefreshToken ? 'PRESENT' : 'NULL');
      console.log('githubAccessToken:', u.githubAccessToken ? 'PRESENT' : 'NULL');
      console.log('githubAccessTokenExpiresAt:', u.githubAccessTokenExpiresAt);
      console.log('githubTokenValid:', u.githubTokenValid);
    }
  } catch (e) {
    console.error('Error fetching users', e);
  } finally {
    await prisma.$disconnect();
  }
})();
