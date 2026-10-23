// Where a visitor came from (F-58). Address only: no storage, no cookies, no network.
// ?utm_source=instagram&utm_medium=bio gives "instagram-bio", carried to page links (?src=), the full-application
// link (a pre-filled answer) and the message drafted on /apply/. Tests: tools/source-label.test.mjs.

// A part is at most 24 characters, a combined label 49; src= is read back with the longer limit.
const PART_MAX = 24;
export const LABEL_MAX = PART_MAX * 2 + 1;

/** A lower-case plain word of at most `max` characters, or ''. */
export function slug(value, max = PART_MAX) {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s && s.length <= max && /^[a-z0-9][a-z0-9_-]*$/.test(s) ? s : '';
}

/** The label from a query string: src, else utm_source[-utm_medium]. */
export function labelFromSearch(search = '') {
  let p;
  try {
    p = new URLSearchParams(search);
  } catch {
    return '';
  }
  const src = slug(p.get('src'), LABEL_MAX);
  if (src) return src;
  const source = slug(p.get('utm_source'));
  if (!source) return '';
  const medium = slug(p.get('utm_medium'));
  return medium ? `${source}-${medium}` : source;
}

const REFERRERS = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)facebook\.com$/, 'facebook'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, 'x'],
  [/^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/, 'google'], // search only
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
];

/** A coarse label from document.referrer, only when the address has none. Many apps hide the referrer. */
export function labelFromReferrer(referrer = '', ownHost = '') {
  let host;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return '';
  }
  if (!host || host === ownHost || host.endsWith(`.${ownHost}`)) return '';
  const hit = REFERRERS.find(([re]) => re.test(host));
  return hit ? hit[1] : '';
}

export const sourceLabel = (search, referrer, ownHost) => labelFromSearch(search) || labelFromReferrer(referrer, ownHost);

/** The message line the Apply page adds. */
export const viaLine = (label) => (label ? `Via diogofit.com (${label})` : 'Via diogofit.com');

/** Browser: the label for this page view. */
export const currentLabel = () =>
  typeof location === 'undefined' ? '' : sourceLabel(location.search, typeof document === 'undefined' ? '' : document.referrer, location.hostname);

/** Browser: page links get ?src=label, a[data-form] the pre-filled answer. Never a file, a download, another site or a jump. */
export function carryLabel(label = currentLabel()) {
  if (!label || typeof document === 'undefined') return label;
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.hasAttribute('download')) continue;
    const raw = a.getAttribute('href').trim();
    if (raw.startsWith('#')) continue; // a jump inside this page resolves against the current address as it is
    if (a.hasAttribute('data-mail-via') && /^mailto:/i.test(raw)) {
      // The no-Instagram email link (apply page): its body carries the same Via line as the drafted message (F-58), so an
      // email sent from it is credited to the site like a DM. RFC 6068 wants %20, not +, for spaces.
      const [addr, query = ''] = raw.slice(7).split('?');
      const q = new URLSearchParams(query);
      q.set('body', `\n\n${viaLine(label)}`);
      a.setAttribute('href', `mailto:${addr}?${q.toString().replace(/\+/g, '%20')}`);
      continue;
    }
    let u;
    try {
      u = new URL(raw, document.baseURI || location.href);
    } catch {
      continue;
    }
    if (a.hasAttribute('data-form')) {
      const entry = a.getAttribute('data-form-entry');
      if (entry && /^entry\.\d{4,12}$/.test(entry) && /^https:\/\/docs\.google\.com\/forms\//.test(u.href) && !u.searchParams.has(entry)) {
        u.searchParams.set('usp', 'pp_url');
        u.searchParams.set(entry, label);
        a.setAttribute('href', u.toString());
      }
      continue;
    }
    if (u.origin !== location.origin || u.searchParams.has('src') || u.searchParams.has('utm_source')) continue;
    if (!u.pathname.endsWith('/') || u.pathname.startsWith('//')) continue; // pages only
    if (u.hash && u.pathname === location.pathname) {
      // /apply/#after written as a path: keep this page's own query so the click stays in the loaded document
      a.setAttribute('href', u.pathname + location.search + u.hash);
      continue;
    }
    u.searchParams.set('src', label);
    a.setAttribute('href', u.pathname + u.search + u.hash);
  }
  return label;
}
