/**
 * Player session on the client: the ONLY place that stores, reads, sends or clears the player token.
 *
 * - Storage: localStorage (works in the browser and inside the Capacitor Android WebView).
 * - Every request to /api/* goes through one fetch wrapper (installApiFetch, installed once in
 *   main.tsx). It adds "Authorization: Bearer <token>" when a token exists and the caller did not
 *   set its own Authorization header (admin requests keep their admin token).
 * - 401 { code: 'SESSION_REPLACED' | 'SESSION_INVALID' } on a request that carried the player token
 *   ends the session on this device: local data is cleared and the app returns to /login, where a
 *   message is shown once.
 * - Players from the old app version have no token: nothing is sent and nothing ends their session.
 * - The token is never written to the console, never put in a URL, never stored anywhere else.
 */

export const PLAYER_TOKEN_KEY = 'matin_player_token';
export const PLAYER_TOKEN_EXPIRES_KEY = 'matin_player_token_expires_at';
/** sessionStorage key holding the reason code to show once after a forced logout. */
export const SESSION_ENDED_NOTICE_KEY = 'matin_session_ended_notice';

/** Production server used when the app runs packaged (Capacitor). */
export const NATIVE_API_ORIGIN = 'https://mateen-quran.vercel.app';

export type SessionEndCode = 'SESSION_REPLACED' | 'SESSION_INVALID';

export const SESSION_ENDED_MESSAGES: Record<SessionEndCode, string> = {
  SESSION_REPLACED: 'تم تسجيل دخولك من جهاز آخر، لذلك تم تسجيل خروجك من هذا الجهاز.',
  SESSION_INVALID: 'انتهت جلستك، الرجاء تسجيل الدخول من جديد.',
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOGOUT_TIMEOUT_MS = 5000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { clear?: () => void };

function defaultLocal(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function defaultSession(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isSessionEndCode(value: unknown): value is SessionEndCode {
  return value === 'SESSION_REPLACED' || value === 'SESSION_INVALID';
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Saves playerToken / playerTokenExpiresAt from a server response body.
 * Returns true if a valid token was saved. Invalid or missing values are ignored.
 */
export function savePlayerSession(data: any, storage: StorageLike | null = defaultLocal()): boolean {
  const token = data?.playerToken;
  if (!storage || typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return false;
  try {
    storage.setItem(PLAYER_TOKEN_KEY, token);
    const expiresAt = data?.playerTokenExpiresAt;
    if (typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt))) {
      storage.setItem(PLAYER_TOKEN_EXPIRES_KEY, expiresAt);
    } else {
      storage.removeItem(PLAYER_TOKEN_EXPIRES_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * After login/register: store the new token, or clear any old one if the server sent none
 * (so a token of a previous account is never reused for the new one).
 */
export function replacePlayerSession(data: any, storage: StorageLike | null = defaultLocal()): boolean {
  if (savePlayerSession(data, storage)) return true;
  clearPlayerSession(storage);
  return false;
}

/** The stored token, or null. Expiry is decided by the server (it slides on use). */
export function getPlayerToken(storage: StorageLike | null = defaultLocal()): string | null {
  try {
    const token = storage?.getItem(PLAYER_TOKEN_KEY) ?? null;
    return token && TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function getPlayerTokenExpiresAt(storage: StorageLike | null = defaultLocal()): string | null {
  try {
    return storage?.getItem(PLAYER_TOKEN_EXPIRES_KEY) ?? null;
  } catch {
    return null;
  }
}

export function hasPlayerToken(storage: StorageLike | null = defaultLocal()): boolean {
  return getPlayerToken(storage) !== null;
}

export function clearPlayerSession(storage: StorageLike | null = defaultLocal()): void {
  try {
    storage?.removeItem(PLAYER_TOKEN_KEY);
    storage?.removeItem(PLAYER_TOKEN_EXPIRES_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * Tells the server to revoke this device's session (action 'logout'), then clears the token
 * locally. The local token is cleared even if the request fails or times out.
 */
export async function logoutPlayerSession(
  deps: { fetchImpl?: typeof fetch; storage?: StorageLike | null; timeoutMs?: number } = {}
): Promise<void> {
  const storage = deps.storage === undefined ? defaultLocal() : deps.storage;
  const token = getPlayerToken(storage);
  try {
    if (token) {
      const fetchImpl = deps.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
      if (fetchImpl) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), deps.timeoutMs ?? LOGOUT_TIMEOUT_MS) : null;
        try {
          await fetchImpl('/api/player-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'logout' }),
            signal: controller?.signal,
          });
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
    }
  } catch {
    // Offline or server error: the local token is still removed below.
  } finally {
    clearPlayerSession(storage);
  }
}

// ---------------------------------------------------------------------------
// Forced logout (session replaced / invalid)
// ---------------------------------------------------------------------------

let sessionEnding = false;

export interface SessionEndDeps {
  local?: StorageLike | null;
  session?: StorageLike | null;
  /** Navigation (defaults to window.location.href = '/login'). */
  redirect?: (path: string) => void;
}

/**
 * Ends the player session on this device: clears the token and the local player data (same
 * cleanup as a normal logout), remembers which message to show, and goes to /login.
 * Runs at most once per page load (several requests may fail at the same time).
 */
export function endPlayerSessionLocally(code: SessionEndCode, deps: SessionEndDeps = {}): boolean {
  if (sessionEnding || !isSessionEndCode(code)) return false;
  sessionEnding = true;
  const local = deps.local === undefined ? defaultLocal() : deps.local;
  const session = deps.session === undefined ? defaultSession() : deps.session;

  clearPlayerSession(local);
  try {
    local?.clear?.();
  } catch {
    // ignore
  }
  try {
    session?.clear?.();
  } catch {
    // ignore
  }
  try {
    session?.setItem(SESSION_ENDED_NOTICE_KEY, code);
  } catch {
    // ignore
  }

  const redirect =
    deps.redirect ??
    ((path: string) => {
      if (typeof window !== 'undefined') window.location.href = path;
    });
  try {
    redirect('/login');
  } catch {
    // ignore
  }
  return true;
}

/** Returns (and removes) the message to show after a forced logout, or null. */
export function takeSessionEndedMessage(session: StorageLike | null = defaultSession()): string | null {
  try {
    const code = session?.getItem(SESSION_ENDED_NOTICE_KEY);
    if (code === null || code === undefined) return null;
    session?.removeItem(SESSION_ENDED_NOTICE_KEY);
    return isSessionEndCode(code) ? SESSION_ENDED_MESSAGES[code] : null;
  } catch {
    return null;
  }
}

/** Reads { code } from a 401 response without consuming the original body. */
export async function readSessionEndCode(res: Response): Promise<SessionEndCode | null> {
  if (!res || res.status !== 401) return null;
  try {
    const body = await res.clone().json();
    return isSessionEndCode(body?.code) ? body.code : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetch wrapper for /api/*
// ---------------------------------------------------------------------------

/** Relative "/api/..." path for an app API URL, or null for anything else (other sites, assets). */
export function apiPathOf(url: string, currentOrigin?: string): string | null {
  if (typeof url !== 'string') return null;
  if (url.startsWith('/api/')) return url;
  for (const origin of [currentOrigin, NATIVE_API_ORIGIN]) {
    if (origin && url.startsWith(`${origin}/api/`)) return url.slice(origin.length);
  }
  return null;
}

/** Adds the Bearer token unless the caller already set an Authorization header. */
export function withPlayerAuthorization(
  init: RequestInit | undefined,
  token: string | null
): { init: RequestInit | undefined; attached: boolean } {
  if (!token) return { init, attached: false };
  const headers = new Headers(init?.headers ?? undefined);
  if (headers.has('authorization')) return { init, attached: false };
  headers.set('Authorization', `Bearer ${token}`);
  // Plain object: works with the browser fetch and with CapacitorHttp's native fetch on Android.
  const plain: Record<string, string> = {};
  headers.forEach((value, key) => {
    plain[key] = value;
  });
  return { init: { ...(init ?? {}), headers: plain }, attached: true };
}

export interface InstallApiFetchOptions {
  isNative?: () => boolean;
  storage?: StorageLike | null;
  onSessionEnded?: (code: SessionEndCode) => void;
}

/**
 * Wraps target.fetch once:
 *  - native app: "/api/..." goes to the production server (was in main.tsx before);
 *  - adds the player token to /api/* requests;
 *  - ends the session on 401 SESSION_REPLACED / SESSION_INVALID for requests that carried it.
 */
export function installApiFetch(target: any, options: InstallApiFetchOptions = {}): void {
  if (!target || typeof target.fetch !== 'function' || target.__matinApiFetchInstalled) return;
  const originalFetch = target.fetch.bind(target);
  const isNative = options.isNative ?? (() => false);
  const onSessionEnded = options.onSessionEnded ?? ((code: SessionEndCode) => endPlayerSessionLocally(code));

  target.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Request objects are passed through unchanged (none of the app's /api calls use them).
    if (typeof input !== 'string' && !(input instanceof URL)) return originalFetch(input, init);
    const url = typeof input === 'string' ? input : input.href;
    const origin = target.location?.origin;
    const path = apiPathOf(url, origin);
    if (!path) return originalFetch(input, init);

    const storage = options.storage === undefined ? defaultLocal() : options.storage;
    const { init: authInit, attached } = withPlayerAuthorization(init, getPlayerToken(storage));
    const finalUrl = url.startsWith('/api/') && isNative() ? `${NATIVE_API_ORIGIN}${url}` : input;

    const promise: Promise<Response> = originalFetch(finalUrl, authInit);
    if (!attached) return promise;
    return promise.then((res: Response) => {
      if (res && res.status === 401) {
        readSessionEndCode(res).then((code) => {
          if (code) onSessionEnded(code);
        });
      }
      return res;
    });
  };
  target.__matinApiFetchInstalled = true;
}

/** Test helper: allows endPlayerSessionLocally to run again. */
export function __resetSessionEndingForTests(): void {
  sessionEnding = false;
}
