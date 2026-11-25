/**
 * Khatma (Quran reading progress) in the app.
 *
 * A Mushaf page counts as read once it stayed on screen requiredSeconds(page) while the app is
 * visible (hidden page / background / screen off pause the timer). Read pages are kept locally
 * (with a queue of pages not yet confirmed by the server) and sent in batches; the server checks
 * them and keeps the real progress (api/friends.ts, action 'khatma-progress').
 *
 * The constants are duplicated in api/_lib/khatma.ts for the server (the app cannot import /api);
 * tests/khatma.test.ts checks they match. Change both together.
 */

export const TOTAL_PAGES = 604;
export const PAGE_READ_SECONDS = 45;
export const SHORT_PAGE_READ_SECONDS = 20;
export const SHORT_PAGES: readonly number[] = [1, 2];

export function requiredSeconds(page: number): number {
  return SHORT_PAGES.includes(page) ? SHORT_PAGE_READ_SECONDS : PAGE_READ_SECONDS;
}

/** Send after this many new read pages... */
export const KHATMA_FLUSH_PAGES = 5;
/** ...or every this many ms while the Mushaf is open (and when it is hidden / closed / back online). */
export const KHATMA_FLUSH_MS = 180_000;

// ---------------------------------------------------------------------------
// Reading timer
// ---------------------------------------------------------------------------
type DocLike = Pick<Document, 'addEventListener' | 'removeEventListener'> & { visibilityState: DocumentVisibilityState | string };

export interface PageReadTracker {
  /** The page on screen (null = no page shown, e.g. the Mushaf is closed). */
  setPage: (page: number | null) => void;
  stop: () => void;
}

/**
 * Counts, per page, the time it stays on screen while the document is visible. Calls onRead(page)
 * once when a page reaches requiredSeconds(page). Leaving a page keeps its time for the session
 * (coming back continues). Only visibilitychange / Capacitor resume count; blur never pauses it.
 */
export function createPageReadTracker(opts: {
  onRead: (page: number) => void;
  doc?: DocLike;
  now?: () => number;
  tickMs?: number;
  setIntervalFn?: (fn: () => void, ms: number) => any;
  clearIntervalFn?: (id: any) => void;
}): PageReadTracker {
  const doc = opts.doc ?? (typeof document !== 'undefined' ? (document as DocLike) : undefined);
  const now = opts.now ?? (() => Date.now());
  const setIntervalFn = opts.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = opts.clearIntervalFn ?? ((id) => clearInterval(id));
  const spent = new Map<number, number>(); // ms on screen per page
  const done = new Set<number>();
  let page: number | null = null;
  let since: number | null = null; // counting since (visible and a page shown)

  const visible = () => !doc || doc.visibilityState !== 'hidden';
  const settle = () => {
    if (page !== null && since !== null) {
      const t = now();
      spent.set(page, (spent.get(page) || 0) + (t - since));
      since = t;
      if (!done.has(page) && (spent.get(page) || 0) >= requiredSeconds(page) * 1000) {
        done.add(page);
        opts.onRead(page);
      }
    }
  };
  const resume = () => {
    since = page !== null && visible() ? now() : null;
  };
  const onVisibility = () => {
    settle();
    resume();
  };

  doc?.addEventListener('visibilitychange', onVisibility);
  doc?.addEventListener('resume', onVisibility);
  const timer = setIntervalFn(settle, opts.tickMs ?? 1000);

  return {
    setPage: (next) => {
      settle();
      page = next !== null && Number.isInteger(next) && next >= 1 && next <= TOTAL_PAGES ? next : null;
      resume();
    },
    stop: () => {
      settle();
      page = null;
      since = null;
      clearIntervalFn(timer);
      doc?.removeEventListener('visibilitychange', onVisibility);
      doc?.removeEventListener('resume', onVisibility);
    },
  };
}

// ---------------------------------------------------------------------------
// Local state + server sync
// ---------------------------------------------------------------------------
export interface KhatmaState {
  /** Pages of the current cycle confirmed by the server. */
  serverRead: number[];
  /** Pages read on this device, not confirmed yet (sent in batches; kept while offline). */
  pending: number[];
  completedCount: number;
  cycle: number;
}

export interface KhatmaView {
  pagesRead: number;
  totalPages: number;
  percentage: number;
  completedCount: number;
  remaining: number;
  /** First page of the current cycle not read yet (null when all are read). */
  firstUnread: number | null;
  /** Some pages are only on this device (waiting to be sent). */
  unsynced: boolean;
}

export const emptyKhatma = (): KhatmaState => ({ serverRead: [], pending: [], completedCount: 0, cycle: 1 });

const keyOf = (playerKey: string) => `khatma_v1_${playerKey || 'guest'}`;
const isPage = (p: unknown) => Number.isInteger(p) && (p as number) >= 1 && (p as number) <= TOTAL_PAGES;

export function loadKhatma(playerKey: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): KhatmaState {
  try {
    const raw = storage?.getItem(keyOf(playerKey));
    if (!raw) return emptyKhatma();
    const s = JSON.parse(raw);
    return {
      serverRead: Array.isArray(s.serverRead) ? s.serverRead.filter(isPage) : [],
      pending: Array.isArray(s.pending) ? s.pending.filter(isPage) : [],
      completedCount: Number(s.completedCount) || 0,
      cycle: Number(s.cycle) || 1,
    };
  } catch {
    return emptyKhatma();
  }
}

export function saveKhatma(playerKey: string, state: KhatmaState, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(keyOf(playerKey), JSON.stringify(state));
  } catch {
    // storage full / unavailable: the progress stays in memory until the next sync
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** A page just counted as read on this device. */
export function addReadPage(state: KhatmaState, page: number): KhatmaState {
  if (!isPage(page) || state.serverRead.includes(page) || state.pending.includes(page)) return state;
  return { ...state, pending: [...state.pending, page] };
}

export function viewKhatma(state: KhatmaState): KhatmaView {
  const read = new Set([...state.serverRead, ...state.pending]);
  let firstUnread: number | null = null;
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    if (!read.has(p)) {
      firstUnread = p;
      break;
    }
  }
  return {
    pagesRead: read.size,
    totalPages: TOTAL_PAGES,
    percentage: Math.floor((read.size / TOTAL_PAGES) * 100),
    completedCount: state.completedCount,
    remaining: TOTAL_PAGES - read.size,
    firstUnread,
    unsynced: state.pending.length > 0,
  };
}

export interface KhatmaServerReply {
  accepted?: number[];
  deferred?: number[];
  dropped?: number[];
  khatma?: { readPages?: number[]; completedCount?: number; cycle?: number };
}

/**
 * Apply the server's answer to a batch: its page list is the truth; accepted and dropped pages
 * leave the queue, deferred ones (over the time budget / daily cap) stay for a later batch.
 * A new cycle on the server (khatma completed) clears what was queued for the old one.
 */
export function applyServerReply(state: KhatmaState, reply: KhatmaServerReply): KhatmaState {
  const k = reply.khatma;
  if (!k) return state;
  const serverRead = (k.readPages || []).filter(isPage);
  const cycle = Number(k.cycle) || 1;
  const done = new Set([...(reply.accepted || []), ...(reply.dropped || []), ...serverRead]);
  const pending = cycle > state.cycle ? [] : state.pending.filter((p) => !done.has(p));
  return { serverRead, pending, completedCount: Number(k.completedCount) || 0, cycle };
}
