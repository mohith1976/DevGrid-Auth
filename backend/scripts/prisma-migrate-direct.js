const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  console.log('[prisma-migrate-direct] Using DIRECT_URL for DATABASE_URL');
} else {
  console.warn('[prisma-migrate-direct] DIRECT_URL not set, falling back to DATABASE_URL from .env');
}

try {
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit', env: process.env });
} catch (e) {
  console.error('[prisma-migrate-direct] prisma migrate dev failed');
  process.exit(e.status || 1);
}
