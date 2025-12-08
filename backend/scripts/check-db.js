const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    console.log('userCount:', userCount);
    // list first 5 users if any
    if (userCount > 0) {
      const users = await prisma.user.findMany({ take: 5 });
      console.log('sampleUsers:', users);
    }
  } catch (e) {
    console.error('Error querying DB:', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
