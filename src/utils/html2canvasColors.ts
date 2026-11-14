/**
 * html2canvas 1.4.1 cannot parse modern CSS colours (oklch(), oklab(), ...), which Tailwind v4
 * uses everywhere; it throws "Attempting to parse an unsupported color function" and no image is
 * produced. Call this from html2canvas's `onclone` on the cloned element: every modern colour in
 * the computed style of the element and its descendants is written back inline as rgba().
 * Only the throw-away clone is touched, never the visible page.
 */

const MODERN_COLOR = /\b(oklch|oklab|lab|lch|color)\(/i;

const COLOR_PROPS = [
  'color',
  'backgroundColor',
  'backgroundImage',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'boxShadow',
  'textShadow',
  'fill',
  'stroke',
] as const;

let ctx: CanvasRenderingContext2D | null | undefined;

/** Converts one CSS colour to rgba() by letting the browser paint it on a 1x1 canvas. */
function toRgba(color: string): string {
  if (ctx === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
  }
  if (!ctx) return 'rgba(0, 0, 0, 1)';
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
}

/** Replaces every modern colour function inside a CSS value (gradients, shadows...) with rgba(). */
export function replaceModernColors(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const rest = value.slice(i);
    const m = MODERN_COLOR.exec(rest);
    if (!m) {
      out += rest;
      break;
    }
    const start = i + m.index;
    out += value.slice(i, start);
    // find the matching closing parenthesis
    let depth = 0;
    let end = start + m[0].length - 1;
    for (; end < value.length; end++) {
      if (value[end] === '(') depth++;
      else if (value[end] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    out += toRgba(value.slice(start, end + 1));
    i = end + 1;
  }
  return out;
}

/** Inlines rgba() versions of modern colours on `root` and all its descendants (clone only). */
export function inlineLegacyColors(root: HTMLElement | null, win: Window | null | undefined): void {
  if (!root || !win) return;
  const elements: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of elements) {
    const style = (el as HTMLElement).style;
    if (!style) continue;
    const computed = win.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const value = (computed as any)[prop];
      if (typeof value === 'string' && MODERN_COLOR.test(value)) {
        (style as any)[prop] = replaceModernColors(value);
      }
    }
  }
}
