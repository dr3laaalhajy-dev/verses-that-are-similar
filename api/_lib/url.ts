/**
 * Modern WHATWG URL Parser for API routes (replaces legacy url.parse).
 * Adheres to Node.js & WHATWG standard URL API:
 * const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
 */
export function parseRequestUrl(req: { url?: string; headers?: Record<string, any> }): URL {
  const host = req.headers?.host || req.headers?.['x-forwarded-host'] || 'localhost';
  const protocol = req.headers?.['x-forwarded-proto'] || 'http';
  const rawUrl = req.url || '/';
  return new URL(rawUrl, `${protocol}://${host}`);
}

export function getUrlSearchParams(req: { url?: string; headers?: Record<string, any> }): URLSearchParams {
  return parseRequestUrl(req).searchParams;
}

// Global suppressor for Node.js DEP0005 (url.parse() deprecation warning)
// emitted by legacy transitive dependencies to keep server logs completely clean
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  const existingListeners = process.listeners('warning');
  const alreadyRegistered = existingListeners.some((fn: any) => (fn as any).__isUrlDeprecationFilter);

  if (!alreadyRegistered) {
    const filterWarning = (warning: any) => {
      if (warning && (warning.name === 'DeprecationWarning' || warning.code === 'DEP0005')) {
        if (warning.code === 'DEP0005' || String(warning.message || '').includes('url.parse')) {
          // Silently discard url.parse deprecation warning
          return;
        }
      }
      console.warn(warning);
    };
    (filterWarning as any).__isUrlDeprecationFilter = true;
    process.on('warning', filterWarning);
  }
}

export default parseRequestUrl;

