import jwt from 'jsonwebtoken';

/** Used ONLY for local development (no NODE_ENV=production and no VERCEL_ENV). */
const DEV_ONLY_FALLBACK_SECRET = 'dev-fallback-local-only-change-me-immediately-32chars!';

/** True on any deployed environment: NODE_ENV=production, or any Vercel environment (VERCEL_ENV set). */
export function isDeployedEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
}

/**
 * Returns the admin JWT secret. Fails closed: when deployed and JWT_SECRET is missing/empty,
 * it throws instead of falling back, so admin tokens are never signed or verified with a
 * hardcoded secret. Resolved at call time (not import time) so a missing secret only breaks
 * admin authentication (callers turn the error into 401/500), not whole endpoints.
 */
export function getAdminJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) return secret;
  if (isDeployedEnvironment()) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  return DEV_ONLY_FALLBACK_SECRET;
}

export function signAdminToken(payload: object, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, getAdminJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: expiresIn as any,
  });
}

export function verifyAdminToken(token: string): any {
  return jwt.verify(token, getAdminJwtSecret(), {
    algorithms: ['HS256'],
  });
}
