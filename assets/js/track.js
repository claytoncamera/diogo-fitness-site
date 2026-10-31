import { currentLabel } from './source.js?v=1be3eee2';

// Analytics: one tiny seam. Works with Plausible, GA4 or nothing.
// Lives in its own module on purpose: the lazy modules import it, and importing main.js from them would
// evaluate main.js a second time (the page loads it with a ?v= cache-buster) and double every listener.
export function track(name, props = {}) {
  try {
    const source = currentLabel();
    if (source && !('source' in props)) props = { ...props, source };
    if (typeof window.plausible === 'function') window.plausible(name, { props });
    if (typeof window.gtag === 'function') window.gtag('event', name, props);
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') console.debug('[track]', name, props);
  } catch { /* analytics must never break the page */ }
}
