import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signJwt(payload: object, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
