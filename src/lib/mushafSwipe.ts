/**
 * Page turning by swipe / mouse drag in the Mushaf (Arabic, right-to-left book):
 * grab the page's left edge and pull it to the right (dx > 0) = next page;
 * pull from right to left (dx < 0) = previous page.
 * Returns null for a short or mostly vertical movement (a tap, a scroll, a pan).
 */
export function swipePageTurn(dx: number, dy: number, threshold: number): 'next' | 'prev' | null {
  if (Math.abs(dx) <= threshold || Math.abs(dx) <= Math.abs(dy) * 1.3) return null;
  return dx > 0 ? 'next' : 'prev';
}

/**
 * Horizontal travel of the page-turn animation: the page moves the way the finger moved
 * (next = to the right, previous = to the left). Used by the flip variants.
 */
export function pageTurnTravel(direction: 'next' | 'prev'): 1 | -1 {
  return direction === 'next' ? 1 : -1;
}
