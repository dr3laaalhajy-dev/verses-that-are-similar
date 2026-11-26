/**
 * Mushaf page turning (Arabic, right-to-left book): pull the left edge to the right = next page,
 * right to left = previous page. Touch and mouse alike; the flip animation follows the finger.
 *   node --import tsx --test tests/mushaf-swipe.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { swipePageTurn, pageTurnTravel } from '../src/lib/mushafSwipe.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('swipe direction', () => {
  it('left -> right (dx > 0) = next page', () => {
    assert.equal(swipePageTurn(120, 5, 40), 'next');
  });
  it('right -> left (dx < 0) = previous page', () => {
    assert.equal(swipePageTurn(-120, 5, 40), 'prev');
  });
  it('short movement or tap: nothing', () => {
    assert.equal(swipePageTurn(30, 0, 40), null);
    assert.equal(swipePageTurn(-40, 0, 40), null);
  });
  it('mostly vertical (scrolling): nothing', () => {
    assert.equal(swipePageTurn(60, 80, 40), null);
    assert.equal(swipePageTurn(-60, -80, 40), null);
  });
  it('mouse threshold (50) works the same way', () => {
    assert.equal(swipePageTurn(51, 0, 50), 'next');
    assert.equal(swipePageTurn(-51, 0, 50), 'prev');
    assert.equal(swipePageTurn(50, 0, 50), null);
  });
});

describe('flip animation follows the finger', () => {
  it('next: the old page leaves to the right, the new one comes from the left', () => {
    assert.equal(pageTurnTravel('next'), 1);
    assert.equal(pageTurnTravel('prev'), -1);
    const src = read('../src/components/QuranZoomViewer.tsx');
    assert.match(src, /enter: \(direction: 'next' \| 'prev'\) => \(\{\n\s+rotateY: -65 \* pageTurnTravel\(direction\),\n\s+x: -35 \* pageTurnTravel\(direction\),/);
    assert.match(src, /exit: \(direction: 'next' \| 'prev'\) => \(\{\n\s+rotateY: 65 \* pageTurnTravel\(direction\),\n\s+x: 35 \* pageTurnTravel\(direction\),/);
  });
});

describe('wiring', () => {
  const viewer = read('../src/components/QuranZoomViewer.tsx');
  it('touch and mouse both use the shared rule (no own dx < 0 logic)', () => {
    assert.equal((viewer.match(/swipePageTurn\(dx, dy, (40|50)\)/g) || []).length, 2);
    assert.doesNotMatch(viewer, /if \(dx < 0\)/);
  });
  it('arrow buttons and keys are unchanged: left key = next, right key = previous', () => {
    const ctx = read('../src/contexts/AppContext.tsx');
    assert.match(ctx, /e\.key === 'ArrowLeft'\) \{\n\s+if \(currentPage < 604\) \{\n\s+setPageTurnDirection\('next'\);/);
    assert.match(ctx, /e\.key === 'ArrowRight'\) \{\n\s+if \(currentPage > 1\) \{\n\s+setPageTurnDirection\('prev'\);/);
  });
});
