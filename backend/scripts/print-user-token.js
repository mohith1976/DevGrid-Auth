#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/print-user-token.js <userId>');
    process.exit(2);
  }
  const userId = args[0];
  const prisma = new PrismaClient();
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { githubAccessToken: true } });
    if (!dbUser) { console.error('DB user not found'); process.exit(3); }
    console.log(dbUser.githubAccessToken || 'NULL');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
