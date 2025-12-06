import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not set in environment');
  // expect base64 encoded 32 bytes
  return Buffer.from(key, 'base64');
}

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as base64 iv:cipher:tag
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, encryptedB64, tagB64] = payload.split(':');
  if (!ivB64 || !encryptedB64 || !tagB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
