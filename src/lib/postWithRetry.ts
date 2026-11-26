/**
 * The app's only postWithRetry (room requests via src/lib/roomSync.ts re-export, khatma sync).
 */
export interface PostResult {
  ok: boolean;
  status: number;
  data: any;
}

/**
 * POSTs JSON and retries on network errors and 5xx (not on 4xx: those are real answers such as
 * STALE_QUESTION). Never throws.
 */
export async function postWithRetry(
  url: string,
  body: unknown,
  opts: {
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
    retries?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<PostResult> {
  const fetchImpl = opts.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 600;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: PostResult = { ok: false, status: 0, data: null };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      last = { ok: res.ok, status: res.status, data };
      if (res.ok || (res.status >= 400 && res.status < 500)) return last;
    } catch {
      last = { ok: false, status: 0, data: null };
    }
    if (attempt < retries) await sleep(baseDelayMs * (attempt + 1));
  }
  return last;
}
