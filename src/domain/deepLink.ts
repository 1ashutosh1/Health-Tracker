export type DeepLink = { type: 'checkin'; id: string };

/** Must match `scheme` in app.json. */
const SCHEME = 'healthtracker';

/**
 * Real ids look like "ck_12" or "local_<uuid>". Anything else (spaces, dots, slashes, "../") is not
 * something we ever generated, so it is never put into a route.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/** "checkin/new" is the create screen (a static route that beats [id]), not a check-in called "new". */
const RESERVED_IDS = new Set(['new']);

/**
 * Turns a URL the app was opened with into something we know how to open, or null.
 * Accepts healthtracker://checkin/<id>, with or without a trailing slash, query string or fragment.
 * Everything else returns null: other schemes, other paths, a missing id, extra path segments, garbage.
 * It never throws.
 */
export function parseDeepLink(url: string | null | undefined): DeepLink | null {
  if (typeof url !== 'string') return null;

  // "healthtracker://checkin/ck_1" and "healthtracker:///checkin/ck_1" both put the path after the scheme.
  const match = new RegExp(`^${SCHEME}://+([^?#]*)`, 'i').exec(url.trim());
  if (!match) return null;

  const segments = match[1].split('/');
  if (segments.at(-1) === '') segments.pop(); // one trailing slash is fine
  if (segments.length !== 2 || segments[0] !== 'checkin') return null;

  const id = decodeSegment(segments[1]);
  if (id === null || !ID_PATTERN.test(id) || RESERVED_IDS.has(id)) return null;
  return { type: 'checkin', id };
}

/** decodeURIComponent throws on a stray "%" (for example "%E0%A4%A"), and a bad link must not crash the app. */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
