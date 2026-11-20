import { parseDeepLink } from './deepLink';

describe('parseDeepLink', () => {
  it.each([
    ['a server id', 'healthtracker://checkin/ck_3', 'ck_3'],
    ['a local id', 'healthtracker://checkin/local_8f14e45f-ceea-467f-a0e6-0c5d1c2f5b1a', 'local_8f14e45f-ceea-467f-a0e6-0c5d1c2f5b1a'],
    ['a numeric id', 'healthtracker://checkin/123', '123'],
    ['a trailing slash', 'healthtracker://checkin/ck_3/', 'ck_3'],
    ['a query string', 'healthtracker://checkin/ck_3?source=email&x=1', 'ck_3'],
    ['a query string after a trailing slash', 'healthtracker://checkin/ck_3/?source=email', 'ck_3'],
    ['a fragment', 'healthtracker://checkin/ck_3#top', 'ck_3'],
    ['three slashes after the scheme', 'healthtracker:///checkin/ck_3', 'ck_3'],
    ['an upper-case scheme', 'HealthTracker://checkin/ck_3', 'ck_3'],
    ['surrounding whitespace', '  healthtracker://checkin/ck_3 \n', 'ck_3'],
    ['an encoded id', 'healthtracker://checkin/ck%5F3', 'ck_3'],
  ])('opens a check-in from %s', (_name, url, id) => {
    expect(parseDeepLink(url)).toEqual({ type: 'checkin', id });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['text that is not a URL', 'not a url'],
    ['only the scheme', 'healthtracker://'],
    ['an unknown path', 'healthtracker://banana'],
    ['an unknown path with an id', 'healthtracker://banana/ck_3'],
    ['a missing id', 'healthtracker://checkin'],
    ['a missing id with a slash', 'healthtracker://checkin/'],
    ['a missing id with a query', 'healthtracker://checkin?id=ck_3'],
    ['an empty segment before the id', 'healthtracker://checkin//ck_3'],
    ['extra path segments', 'healthtracker://checkin/ck_3/edit'],
    ['the create screen', 'healthtracker://checkin/new'],
    ['a different scheme', 'otherapp://checkin/ck_3'],
    ['a scheme that only starts the same', 'healthtrackerx://checkin/ck_3'],
    ['a web link', 'https://example.com/checkin/ck_3'],
    ['a dev client launcher link', 'exp+health-tracker://expo-development-client/?url=http%3A%2F%2F192.168.1.2%3A8081'],
    ['an upper-case path', 'healthtracker://CHECKIN/ck_3'],
    ['a malformed percent escape', 'healthtracker://checkin/ck%E0%A4%A'],
    ['an encoded slash in the id', 'healthtracker://checkin/ck%2F3'],
    ['a path traversal id', 'healthtracker://checkin/%2E%2E'],
    ['an id with spaces', 'healthtracker://checkin/ck%203'],
    ['an id that is far too long', `healthtracker://checkin/${'a'.repeat(101)}`],
  ])('returns null for %s', (_name, url) => {
    expect(parseDeepLink(url)).toBeNull();
  });
});
