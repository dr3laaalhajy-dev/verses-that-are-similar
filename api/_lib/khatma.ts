/**
 * Khatma (Quran reading progress) rules for the server. The app has the same constants in
 * src/lib/khatma.ts (tests/khatma.test.ts checks they match; change both together).
 */

export const TOTAL_PAGES = 604;
/** Seconds a normal page must stay on screen to count as read. */
export const PAGE_READ_SECONDS = 45;
/** Seconds for the two short opening pages (Al-Fatiha, the start of Al-Baqarah). */
export const SHORT_PAGE_READ_SECONDS = 20;
export const SHORT_PAGES: readonly number[] = [1, 2];

export function requiredSeconds(page: number): number {
  return SHORT_PAGES.includes(page) ? SHORT_PAGE_READ_SECONDS : PAGE_READ_SECONDS;
}

/** At most this many new pages per player per (UTC) day. */
export const KHATMA_DAILY_CAP = 300;
/** Reading time a single report may claim at most (also after a long pause / offline). */
export const KHATMA_MAX_BUDGET_SECONDS = 600;
/** Clock / network margin added to the reading time budget. */
export const KHATMA_SLACK_SECONDS = 30;

export interface KhatmaRow {
  read_pages?: number[] | null;
  pages_read?: number | null;
  completed_count?: number | null;
  cycle?: number | null;
  last_report_at?: string | null;
  day?: string | null;
  day_pages?: number | null;
}

export interface KhatmaDecision {
  /** New pages to store, in the reported order. */
  accepted: number[];
  /** Valid new pages over the time budget or the daily cap: the app keeps them for later. */
  deferred: number[];
  /** Not pages (outside 1..604, not integers) or already read: the app drops them. */
  dropped: number[];
}

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * Which reported pages are accepted now. Reading time budget = seconds since the last accepted
 * report (capped at KHATMA_MAX_BUDGET_SECONDS; no report yet = the cap) + KHATMA_SLACK_SECONDS;
 * pages are accepted in order while the sum of their requiredSeconds fits. Daily cap
 * KHATMA_DAILY_CAP new pages.
 */
export function decideKhatmaPages(row: KhatmaRow | null, reported: unknown, now: number = Date.now()): KhatmaDecision {
  const already = new Set((row?.read_pages || []).map(Number));
  const list = Array.isArray(reported) ? reported : [];
  const seen = new Set<number>();
  const candidates: number[] = [];
  const dropped: number[] = [];
  for (const raw of list) {
    const p = Number(raw);
    if (!Number.isInteger(p) || p < 1 || p > TOTAL_PAGES || already.has(p) || seen.has(p)) {
      if (Number.isFinite(p)) dropped.push(p);
      continue;
    }
    seen.add(p);
    candidates.push(p);
  }

  const last = row?.last_report_at ? new Date(row.last_report_at).getTime() : NaN;
  const elapsed = Number.isFinite(last) ? Math.max(0, (now - last) / 1000) : KHATMA_MAX_BUDGET_SECONDS;
  const budget = Math.min(elapsed, KHATMA_MAX_BUDGET_SECONDS) + KHATMA_SLACK_SECONDS;
  const usedToday = row?.day === utcDay(now) ? Number(row?.day_pages) || 0 : 0;

  const accepted: number[] = [];
  const deferred: number[] = [];
  let spent = 0;
  for (const p of candidates) {
    const cost = requiredSeconds(p);
    if (usedToday + accepted.length >= KHATMA_DAILY_CAP || spent + cost > budget) {
      deferred.push(p);
      continue;
    }
    spent += cost;
    accepted.push(p);
  }
  return { accepted, deferred, dropped };
}

export interface KhatmaSummary {
  pagesRead: number;
  totalPages: number;
  percentage: number;
  completedCount: number;
  cycle: number;
  readPages: number[];
}

export function khatmaSummary(row: KhatmaRow | null): KhatmaSummary {
  const readPages = [...new Set((row?.read_pages || []).map(Number))]
    .filter((p) => Number.isInteger(p) && p >= 1 && p <= TOTAL_PAGES)
    .sort((a, b) => a - b);
  return {
    pagesRead: readPages.length,
    totalPages: TOTAL_PAGES,
    percentage: Math.floor((readPages.length / TOTAL_PAGES) * 100),
    completedCount: Number(row?.completed_count) || 0,
    cycle: Number(row?.cycle) || 1,
    readPages,
  };
}
