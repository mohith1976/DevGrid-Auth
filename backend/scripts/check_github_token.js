const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

async function run() {
  const prisma = new PrismaClient();
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    console.error('No ENCRYPTION_KEY in env');
    process.exit(1);
  }
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');

  function decrypt(payload) {
    const [ivB64, encB64, tagB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }

  try {
    const user = await prisma.user.findFirst({ where: { githubAccessToken: { not: null } } });
    if (!user) {
      console.log('No user with token found');
      await prisma.$disconnect();
      return;
    }
    console.log('Found user', { id: user.id, username: user.username, githubId: user.githubId, githubScope: user.githubScope });
    const token = decrypt(user.githubAccessToken);

    const res1 = await axios.get('https://api.github.com/user', { headers: { Authorization: `token ${token}`, 'User-Agent': 'DevGrid' } }).catch(e => e.response || e);
    console.log('/user status', res1.status || res1.statusCode, 'x-oauth-scopes', res1.headers ? (res1.headers['x-oauth-scopes'] || res1.headers['X-OAuth-Scopes']) : undefined);

    const res2 = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `token ${token}`, 'User-Agent': 'DevGrid' } }).catch(e => e.response || e);
    console.log('/user/emails status', res2.status || res2.statusCode, 'emails.length', Array.isArray(res2.data) ? res2.data.length : typeof res2.data);
  } catch (err) {
    console.error('Error during check:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
