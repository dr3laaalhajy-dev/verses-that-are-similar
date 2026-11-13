import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_TOKEN_KEY,
  PLAYER_TOKEN_EXPIRES_KEY,
  SESSION_ENDED_NOTICE_KEY,
  SESSION_ENDED_MESSAGES,
  NATIVE_API_ORIGIN,
  savePlayerSession,
  replacePlayerSession,
  getPlayerToken,
  getPlayerTokenExpiresAt,
  hasPlayerToken,
  clearPlayerSession,
  logoutPlayerSession,
  endPlayerSessionLocally,
  takeSessionEndedMessage,
  readSessionEndCode,
  apiPathOf,
  withPlayerAuthorization,
  installApiFetch,
  __resetSessionEndingForTests,
} from '../src/lib/playerSession.ts';

// A realistic-shaped fake token (43 base64url chars). Not a real credential.
const TOKEN = 'A'.repeat(20) + '_-' + 'b'.repeat(21);
const TOKEN_2 = 'Z'.repeat(43);
const EXPIRES = '2026-12-13T10:00:00.000Z';

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

// Capture everything written to the console so we can prove the token never appears.
const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;
let consoleOutput: string[] = [];
const originals: Record<string, any> = {};
beforeEach(() => {
  consoleOutput = [];
  for (const m of consoleMethods) {
    originals[m] = (console as any)[m];
    (console as any)[m] = (...args: any[]) => {
      consoleOutput.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
  }
  __resetSessionEndingForTests();
});
afterEach(() => {
  for (const m of consoleMethods) (console as any)[m] = originals[m];
  for (const line of consoleOutput) {
    assert.ok(!line.includes(TOKEN) && !line.includes(TOKEN_2), 'token must never be printed to the console');
  }
});

function jsonResponse(status: number, body: any): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeTarget(responder: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const target: any = {
    location: { origin: 'https://preview.example.test' },
    fetch: async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.href ?? input.url;
      calls.push({ url, init });
      return responder(url, init);
    },
  };
  return { target, calls };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function authOf(init?: RequestInit): string | null {
  return new Headers(init?.headers ?? undefined).get('authorization');
}

describe('storage: save / read / clear', () => {
  it('saves token and expiry from a login/register response and reads them back', () => {
    const s = new MemoryStorage();
    assert.equal(savePlayerSession({ player: {}, playerToken: TOKEN, playerTokenExpiresAt: EXPIRES }, s), true);
    assert.equal(getPlayerToken(s), TOKEN);
    assert.equal(getPlayerTokenExpiresAt(s), EXPIRES);
    assert.equal(hasPlayerToken(s), true);
    assert.deepEqual([...s.map.keys()].sort(), [PLAYER_TOKEN_EXPIRES_KEY, PLAYER_TOKEN_KEY].sort());
  });

  it('ignores missing or malformed tokens', () => {
    const s = new MemoryStorage();
    for (const bad of [undefined, null, '', 'short', TOKEN + 'x', 'A'.repeat(42) + '=', 123, { t: TOKEN }]) {
      assert.equal(savePlayerSession({ playerToken: bad }, s), false);
    }
    assert.equal(s.map.size, 0);
    assert.equal(getPlayerToken(s), null);
  });

  it('drops an invalid expiry but keeps the token', () => {
    const s = new MemoryStorage();
    s.setItem(PLAYER_TOKEN_EXPIRES_KEY, EXPIRES);
    assert.equal(savePlayerSession({ playerToken: TOKEN, playerTokenExpiresAt: 'not a date' }, s), true);
    assert.equal(getPlayerTokenExpiresAt(s), null);
  });

  it('a corrupted stored value is not returned as a token', () => {
    const s = new MemoryStorage();
    s.setItem(PLAYER_TOKEN_KEY, 'garbage value');
    assert.equal(getPlayerToken(s), null);
  });

  it('clearPlayerSession removes only the token keys', () => {
    const s = new MemoryStorage();
    s.setItem('quran_player_name', 'x');
    savePlayerSession({ playerToken: TOKEN, playerTokenExpiresAt: EXPIRES }, s);
    clearPlayerSession(s);
    assert.equal(getPlayerToken(s), null);
    assert.equal(getPlayerTokenExpiresAt(s), null);
    assert.equal(s.getItem('quran_player_name'), 'x');
  });

  it('replacePlayerSession clears an old token when the server sent none', () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    assert.equal(replacePlayerSession({ player: {} }, s), false);
    assert.equal(getPlayerToken(s), null);
    assert.equal(replacePlayerSession({ playerToken: TOKEN_2 }, s), true);
    assert.equal(getPlayerToken(s), TOKEN_2);
  });

  it('a storage that throws never breaks the app', () => {
    const throwing: any = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    assert.equal(savePlayerSession({ playerToken: TOKEN }, throwing), false);
    assert.equal(getPlayerToken(throwing), null);
    assert.doesNotThrow(() => clearPlayerSession(throwing));
    assert.equal(getPlayerToken(null), null);
  });
});

describe('fetch wrapper helpers', () => {
  it('apiPathOf accepts only the app API', () => {
    const origin = 'https://preview.example.test';
    assert.equal(apiPathOf('/api/player-score', origin), '/api/player-score');
    assert.equal(apiPathOf(`${origin}/api/x?y=1`, origin), '/api/x?y=1');
    assert.equal(apiPathOf(`${NATIVE_API_ORIGIN}/api/x`, origin), '/api/x');
    assert.equal(apiPathOf('https://api.alquran.cloud/v1/ayah/1', origin), null);
    assert.equal(apiPathOf('https://evil.test/api/x', origin), null);
    assert.equal(apiPathOf('/apix', origin), null);
    assert.equal(apiPathOf('/assets/a.png', origin), null);
  });

  it('withPlayerAuthorization adds the Bearer header and keeps other headers', () => {
    const { init, attached } = withPlayerAuthorization(
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      TOKEN
    );
    assert.equal(attached, true);
    assert.equal(authOf(init), `Bearer ${TOKEN}`);
    assert.equal(new Headers(init!.headers).get('content-type'), 'application/json');
    assert.equal(init!.method, 'POST');
    assert.equal(init!.body, '{}');
    assert.ok(!(init!.headers instanceof Headers), 'headers are a plain object (CapacitorHttp friendly)');
  });

  it('never overrides an Authorization header set by the caller (admin token)', () => {
    const own = { headers: { Authorization: 'Bearer admin-jwt' } };
    const r1 = withPlayerAuthorization(own, TOKEN);
    assert.equal(r1.attached, false);
    assert.equal(r1.init, own);
    const r2 = withPlayerAuthorization({ headers: new Headers({ authorization: 'Bearer admin-jwt' }) }, TOKEN);
    assert.equal(r2.attached, false);
  });

  it('no token: request unchanged', () => {
    const init = { method: 'GET' };
    assert.deepEqual(withPlayerAuthorization(init, null), { init, attached: false });
    assert.deepEqual(withPlayerAuthorization(undefined, null), { init: undefined, attached: false });
  });

  it('readSessionEndCode only recognises the two codes on a 401', async () => {
    assert.equal(await readSessionEndCode(jsonResponse(401, { code: 'SESSION_REPLACED' })), 'SESSION_REPLACED');
    assert.equal(await readSessionEndCode(jsonResponse(401, { code: 'SESSION_INVALID' })), 'SESSION_INVALID');
    assert.equal(await readSessionEndCode(jsonResponse(401, { message: 'Invalid token' })), null);
    assert.equal(await readSessionEndCode(jsonResponse(403, { code: 'SESSION_INVALID' })), null);
    assert.equal(await readSessionEndCode(new Response('not json', { status: 401 })), null);
  });
});

describe('installApiFetch', () => {
  it('sends the token to /api/* only', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    const { target, calls } = fakeTarget(() => jsonResponse(200, { ok: true }));
    installApiFetch(target, { storage: s, onSessionEnded: () => assert.fail('must not end') });

    await target.fetch('/api/player-score', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    await target.fetch('https://api.alquran.cloud/v1/ayah/1');
    await target.fetch(new URL('https://preview.example.test/api/settings'));

    assert.equal(authOf(calls[0].init), `Bearer ${TOKEN}`);
    assert.equal(new Headers(calls[0].init!.headers).get('content-type'), 'application/json');
    assert.equal(authOf(calls[1].init), null, 'external sites never get the token');
    assert.equal(authOf(calls[2].init), `Bearer ${TOKEN}`);
    for (const c of calls) assert.ok(!c.url.includes(TOKEN), 'token never in the URL');
  });

  it('native app: /api/* goes to the live server, with the token', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    const { target, calls } = fakeTarget(() => jsonResponse(200, {}));
    installApiFetch(target, { storage: s, isNative: () => true });
    await target.fetch('/api/friends?action=list');
    assert.equal(calls[0].url, `${NATIVE_API_ORIGIN}/api/friends?action=list`);
    assert.equal(authOf(calls[0].init), `Bearer ${TOKEN}`);
  });

  it('web: /api/* stays relative', async () => {
    const { target, calls } = fakeTarget(() => jsonResponse(200, {}));
    installApiFetch(target, { storage: new MemoryStorage(), isNative: () => false });
    await target.fetch('/api/settings');
    assert.equal(calls[0].url, '/api/settings');
  });

  it('old app version (no token): no header, and a 401 never logs the player out', async () => {
    let ended = 0;
    const { target, calls } = fakeTarget(() => jsonResponse(401, { code: 'SESSION_INVALID' }));
    installApiFetch(target, { storage: new MemoryStorage(), onSessionEnded: () => ended++ });
    const res = await target.fetch('/api/player-score');
    await flush();
    assert.equal(authOf(calls[0].init), null);
    assert.equal(res.status, 401);
    assert.equal(ended, 0);
  });

  for (const code of ['SESSION_REPLACED', 'SESSION_INVALID'] as const) {
    it(`401 ${code} with a token ends the session, and the caller can still read the body`, async () => {
      const s = new MemoryStorage();
      savePlayerSession({ playerToken: TOKEN }, s);
      const ended: string[] = [];
      const { target } = fakeTarget(() => jsonResponse(401, { code }));
      installApiFetch(target, { storage: s, onSessionEnded: (c) => ended.push(c) });
      const res = await target.fetch('/api/player-score');
      assert.deepEqual(await res.json(), { code });
      await flush();
      assert.deepEqual(ended, [code]);
    });
  }

  it('other 401s (wrong password, admin token) do not end the player session', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    let ended = 0;
    const { target } = fakeTarget(() => jsonResponse(401, { message: 'Invalid token' }));
    installApiFetch(target, { storage: s, onSessionEnded: () => ended++ });
    await target.fetch('/api/player-register', { method: 'POST', body: '{}' });
    await target.fetch('/api/admin?action=me', { headers: { Authorization: 'Bearer admin-jwt' } });
    await flush();
    assert.equal(ended, 0);
  });

  it('a 401 with a session code on an admin request (own header) is ignored', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    let ended = 0;
    const { target, calls } = fakeTarget(() => jsonResponse(401, { code: 'SESSION_INVALID' }));
    installApiFetch(target, { storage: s, onSessionEnded: () => ended++ });
    await target.fetch('/api/admin?action=me', { headers: { Authorization: 'Bearer admin-jwt' } });
    await flush();
    assert.equal(authOf(calls[0].init), 'Bearer admin-jwt');
    assert.equal(ended, 0);
  });

  it('installs only once', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    const { target, calls } = fakeTarget(() => jsonResponse(200, {}));
    installApiFetch(target, { storage: s, isNative: () => true });
    installApiFetch(target, { storage: s, isNative: () => true });
    await target.fetch('/api/x');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${NATIVE_API_ORIGIN}/api/x`);
  });

  it('network errors are passed to the caller unchanged', async () => {
    const { target } = fakeTarget(() => Promise.reject(new TypeError('offline')));
    installApiFetch(target, { storage: new MemoryStorage() });
    await assert.rejects(target.fetch('/api/x'), /offline/);
  });
});

describe('forced logout on this device', () => {
  it('clears the token and local player data, remembers the message and goes to /login', () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, local);
    local.setItem('quran_player_name', 'لاعب');
    session.setItem('something', '1');
    const redirects: string[] = [];

    assert.equal(endPlayerSessionLocally('SESSION_REPLACED', { local, session, redirect: (p) => redirects.push(p) }), true);
    assert.equal(getPlayerToken(local), null);
    assert.equal(local.map.size, 0);
    assert.deepEqual([...session.map.entries()], [[SESSION_ENDED_NOTICE_KEY, 'SESSION_REPLACED']]);
    assert.deepEqual(redirects, ['/login']);
  });

  it('runs only once even if several requests fail together', () => {
    const redirects: string[] = [];
    const deps = { local: new MemoryStorage(), session: new MemoryStorage(), redirect: (p: string) => redirects.push(p) };
    endPlayerSessionLocally('SESSION_INVALID', deps);
    assert.equal(endPlayerSessionLocally('SESSION_REPLACED', deps), false);
    assert.deepEqual(redirects, ['/login']);
    assert.equal(deps.session.getItem(SESSION_ENDED_NOTICE_KEY), 'SESSION_INVALID');
  });

  it('shows the exact Arabic message once', () => {
    const session = new MemoryStorage();
    session.setItem(SESSION_ENDED_NOTICE_KEY, 'SESSION_REPLACED');
    assert.equal(takeSessionEndedMessage(session), 'تم تسجيل دخولك من جهاز آخر، لذلك تم تسجيل خروجك من هذا الجهاز.');
    assert.equal(takeSessionEndedMessage(session), null);

    session.setItem(SESSION_ENDED_NOTICE_KEY, 'SESSION_INVALID');
    assert.equal(takeSessionEndedMessage(session), 'انتهت جلستك، الرجاء تسجيل الدخول من جديد.');

    session.setItem(SESSION_ENDED_NOTICE_KEY, 'whatever');
    assert.equal(takeSessionEndedMessage(session), null);
    assert.equal(session.getItem(SESSION_ENDED_NOTICE_KEY), null);
    assert.equal(SESSION_ENDED_MESSAGES.SESSION_INVALID, 'انتهت جلستك، الرجاء تسجيل الدخول من جديد.');
  });

  it('unknown codes do nothing', () => {
    const local = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, local);
    assert.equal(endPlayerSessionLocally('NOPE' as any, { local, session: new MemoryStorage(), redirect: () => assert.fail() }), false);
    assert.equal(getPlayerToken(local), TOKEN);
  });

  it('end to end: wrapper + 401 SESSION_REPLACED + default handler', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, local);
    const redirects: string[] = [];
    const { target } = fakeTarget(() => jsonResponse(401, { code: 'SESSION_REPLACED' }));
    installApiFetch(target, {
      storage: local,
      onSessionEnded: (code) => endPlayerSessionLocally(code, { local, session, redirect: (p) => redirects.push(p) }),
    });
    await target.fetch('/api/player-score');
    await flush();
    assert.equal(getPlayerToken(local), null);
    assert.deepEqual(redirects, ['/login']);
    assert.equal(takeSessionEndedMessage(session), SESSION_ENDED_MESSAGES.SESSION_REPLACED);
  });
});

describe('logout', () => {
  it("calls action 'logout' with the token, then clears it", async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN, playerTokenExpiresAt: EXPIRES }, s);
    const calls: { url: string; init: any }[] = [];
    await logoutPlayerSession({
      storage: s,
      fetchImpl: (async (url: any, init: any) => {
        calls.push({ url, init });
        return jsonResponse(200, { success: true });
      }) as any,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/player-register');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'logout' });
    assert.equal(authOf(calls[0].init), `Bearer ${TOKEN}`);
    assert.ok(!calls[0].init.body.includes(TOKEN), 'token only in the header');
    assert.equal(getPlayerToken(s), null);
    assert.equal(getPlayerTokenExpiresAt(s), null);
  });

  it('clears the token even if the request fails', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    await logoutPlayerSession({ storage: s, fetchImpl: (async () => { throw new TypeError('offline'); }) as any });
    assert.equal(getPlayerToken(s), null);
  });

  it('clears the token even if the server answers with an error', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    await logoutPlayerSession({ storage: s, fetchImpl: (async () => jsonResponse(500, {})) as any });
    assert.equal(getPlayerToken(s), null);
  });

  it('gives up after the timeout and still clears', async () => {
    const s = new MemoryStorage();
    savePlayerSession({ playerToken: TOKEN }, s);
    const hang = ((_u: any, init: any) =>
      new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))) as any;
    await logoutPlayerSession({ storage: s, fetchImpl: hang, timeoutMs: 20 });
    assert.equal(getPlayerToken(s), null);
  });

  it('no token (old app version): no request', async () => {
    let called = 0;
    await logoutPlayerSession({ storage: new MemoryStorage(), fetchImpl: (async () => { called++; return jsonResponse(200, {}); }) as any });
    assert.equal(called, 0);
  });
});

describe('the token stays in one place', () => {
  it('only src/lib/playerSession.ts touches the token storage keys', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = fileURLToPath(new URL('../src', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !p.endsWith(join('lib', 'playerSession.ts'))) {
          const text = readFileSync(p, 'utf8');
          if (text.includes(PLAYER_TOKEN_KEY) || /playerToken\b/.test(text)) offenders.push(p);
        }
      }
    };
    walk(root);
    assert.deepEqual(offenders, []);
  });

  it('the helper never calls console', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('../src/lib/playerSession.ts', import.meta.url)), 'utf8');
    assert.equal(/console\./.test(src), false);
  });
});
