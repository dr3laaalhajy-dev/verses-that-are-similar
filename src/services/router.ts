/**
 * Global Router Utility
 * Provides client-side routing, history updates, and deep-link event dispatching
 */

export const router = {
  /**
   * Navigate to a route and dispatch navigation events
   */
  push: (route: string) => {
    if (!route || typeof window === 'undefined') return;
    const cleanRoute = String(route).trim();
    if (!cleanRoute) return;

    // External URL handling
    if (/^https?:\/\//i.test(cleanRoute)) {
      window.open(cleanRoute, '_blank', 'noopener,noreferrer');
      return;
    }

    // Update browser URL & state
    try {
      window.history.pushState({ route: cleanRoute }, '', cleanRoute);
    } catch (e) {
      console.warn('[Router] Failed to pushState:', e);
    }

    // Dispatch custom and postMessage navigation events
    try {
      window.postMessage({
        type: 'DEEP_LINK_NAVIGATE',
        url: cleanRoute,
        route: cleanRoute,
        data: { route: cleanRoute }
      }, '*');
    } catch (e) {
      console.warn('[Router] Failed to postMessage:', e);
    }

    try {
      window.dispatchEvent(new CustomEvent('app_navigate', { detail: { route: cleanRoute } }));
    } catch (e) {}
  },

  /**
   * Replace current route without pushing a new history entry
   */
  replace: (route: string) => {
    if (!route || typeof window === 'undefined') return;
    const cleanRoute = String(route).trim();
    if (!cleanRoute) return;

    if (/^https?:\/\//i.test(cleanRoute)) {
      window.location.replace(cleanRoute);
      return;
    }

    try {
      window.history.replaceState({ route: cleanRoute }, '', cleanRoute);
    } catch (e) {}

    try {
      window.postMessage({
        type: 'DEEP_LINK_NAVIGATE',
        url: cleanRoute,
        route: cleanRoute,
        data: { route: cleanRoute }
      }, '*');
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('app_navigate', { detail: { route: cleanRoute } }));
    } catch (e) {}
  }
};

/**
 * useRouter Hook
 * Compatible with next/navigation standard router hook
 */
export const useRouter = () => router;

export default router;

