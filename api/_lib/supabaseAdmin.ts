import { createClient } from '@supabase/supabase-js';
import './url.js';

/**
 * The ONLY Supabase client used by the server (/api). It authenticates with the
 * service-role key, so it must never fall back to the public anon key or to a
 * hardcoded project: it reads exactly two environment variables and fails closed.
 *
 *   SUPABASE_URL               e.g. https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  the project's service_role (secret) key
 *
 * No alternative names (SUPABASE_KEY, SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY,
 * SUPABASE_SERVICE_KEY, VITE_*, NEXT_PUBLIC_*) are accepted on purpose.
 */
export const REQUIRED_SUPABASE_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

export interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

/**
 * Validates the server's Supabase configuration. Throws a clear error that names
 * the missing/invalid variables (never their values) instead of guessing.
 */
export function getSupabaseServerConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseServerConfig {
  const url = (env.SUPABASE_URL ?? '').trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

  const missing = REQUIRED_SUPABASE_ENV.filter((name) => !(env[name] ?? '').trim());
  if (missing.length > 0) {
    throw new Error(
      `[supabaseAdmin] Missing required environment variable(s): ${missing.join(', ')}. ` +
        'The server refuses to start without them (no fallback to anon keys or hardcoded projects).'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('[supabaseAdmin] SUPABASE_URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('[supabaseAdmin] SUPABASE_URL must use https.');
  }

  return { url, serviceRoleKey };
}

const config = getSupabaseServerConfig();

export const supabaseAdmin = createClient(config.url, config.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export default supabaseAdmin;
