import * as jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signJwt(payload: string | object | Buffer, expiresIn = '7d') {
  // use `any` casts to satisfy type mismatches against installed jsonwebtoken types
  return jwt.sign(payload as any, JWT_SECRET as any, { expiresIn } as any);
}
