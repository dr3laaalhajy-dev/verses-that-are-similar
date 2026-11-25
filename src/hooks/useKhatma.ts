import { useEffect, useRef, useState } from 'react';
import { postWithRetry } from '../lib/postWithRetry';
import {
  KHATMA_FLUSH_MS,
  KHATMA_FLUSH_PAGES,
  addReadPage,
  applyServerReply,
  createPageReadTracker,
  loadKhatma,
  saveKhatma,
  viewKhatma,
  type KhatmaView,
} from '../lib/khatma';

/**
 * Most pages sent in one batch (≈ 400 bytes). Large enough for the server's whole catch-up
 * allowance (KHATMA_MAX_CATCHUP_MS = 60 min ≈ 80 pages) in ONE report: the server restarts the
 * reading-time budget after each accepted report, so splitting it would lose allowance.
 */
const MAX_BATCH = 100;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const inFlight = new Map<string, Promise<void>>();

/** Who the progress belongs to (storage key) and how the server finds the player. */
export function khatmaIdentity(app: any): { key: string; playerId: string | null } {
  const id = app?.playerId || app?.uniquePlayerId || app?.playerUsername || null;
  return { key: id ? String(id) : 'guest', playerId: id ? String(id) : null };
}

/** A page just counted as read: keep it locally (queue); returns how many pages wait to be sent. */
export function markKhatmaPageRead(key: string, page: number): number {
  const next = addReadPage(loadKhatma(key), page);
  saveKhatma(key, next);
  notify();
  return next.pending.length;
}

/**
 * Send the queued pages (or just fetch the player's progress when nothing is queued). One request
 * at a time per player, retried on network / server errors. `keepalive` is for page hide / close:
 * fire-and-forget, the server ignores pages it already has, so a later sync is always safe.
 */
export function syncKhatma(key: string, playerId: string | null, opts: { keepalive?: boolean } = {}): Promise<void> {
  if (!playerId) return Promise.resolve();
  const pages = loadKhatma(key).pending.slice(0, MAX_BATCH);
  const body = { action: 'khatma-progress', playerId, pages };
  if (opts.keepalive) {
    if (pages.length === 0) return Promise.resolve();
    try {
      fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    } catch {
      // nothing: the pages stay queued
    }
    return Promise.resolve();
  }
  const running = inFlight.get(key);
  if (running) return running;
  const job = postWithRetry('/api/friends', body, { retries: 2 })
    .then(({ ok, data }) => {
      if (!ok || !data?.khatma) return; // offline / table not ready: pages stay queued
      saveKhatma(key, applyServerReply(loadKhatma(key), data));
      notify();
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** The player's khatma for display (local first, then the server's numbers). */
export function useKhatmaView(app: any): KhatmaView {
  const { key, playerId } = khatmaIdentity(app);
  const [view, setView] = useState<KhatmaView>(() => viewKhatma(loadKhatma(key)));
  useEffect(() => {
    const update = () => setView(viewKhatma(loadKhatma(key)));
    update();
    listeners.add(update);
    syncKhatma(key, playerId);
    return () => {
      listeners.delete(update);
    };
  }, [key, playerId]);
  return view;
}

/**
 * Reading timer for the Mushaf: `page` is the page on screen (null when none). Sends in batches:
 * every KHATMA_FLUSH_PAGES new pages, every KHATMA_FLUSH_MS, when the page is hidden, when
 * the Mushaf closes and when the connection comes back.
 */
export function useKhatmaReading(app: any, page: number | null) {
  const { key, playerId } = khatmaIdentity(app);
  const trackerRef = useRef<ReturnType<typeof createPageReadTracker> | null>(null);

  useEffect(() => {
    const tracker = createPageReadTracker({
      onRead: (p) => {
        if (markKhatmaPageRead(key, p) >= KHATMA_FLUSH_PAGES) syncKhatma(key, playerId);
      },
    });
    trackerRef.current = tracker;
    const timer = setInterval(() => {
      if (loadKhatma(key).pending.length > 0) syncKhatma(key, playerId);
    }, KHATMA_FLUSH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncKhatma(key, playerId, { keepalive: true });
    };
    const onOnline = () => syncKhatma(key, playerId);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      tracker.stop();
      trackerRef.current = null;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      syncKhatma(key, playerId, { keepalive: true }); // leaving the Mushaf
    };
  }, [key, playerId]);

  useEffect(() => {
    trackerRef.current?.setPage(page);
  }, [page, key, playerId]);
}
