import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

export function getUserIdFromAuthHeader(req: Request): string {
  const auth = (req.headers as any)?.authorization;
  if (!auth) throw new Error('Unauthorized');
  const parts = String(auth).split(' ');
  if (parts.length !== 2) throw new Error('Unauthorized');
  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    if (!payload || !payload.sub) throw new Error('Unauthorized');
    return payload.sub;
  } catch (e) {
    throw new Error('Unauthorized');
  }
}
