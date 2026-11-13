import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is missing.');
}
export const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-fallback-local-only-change-me-immediately-32chars!';

export function signAdminToken(payload: object, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: expiresIn as any,
  });
}

export function verifyAdminToken(token: string): any {
  return jwt.verify(token, EFFECTIVE_JWT_SECRET, {
    algorithms: ['HS256'],
  });
}
