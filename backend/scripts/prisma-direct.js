const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  console.log('[prisma-direct] Using DIRECT_URL for DATABASE_URL');
} else {
  console.warn('[prisma-direct] DIRECT_URL not set, falling back to DATABASE_URL from .env');
}

try {
  execSync('npx prisma db pull', { stdio: 'inherit', env: process.env });
} catch (e) {
  console.error('[prisma-direct] prisma db pull failed');
  process.exit(e.status || 1);
}
