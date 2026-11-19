import { isPersistedItems, isStale, STALE_AFTER_MS } from './cache';

describe('isStale', () => {
  const now = 1_000_000;

  it('is stale when nothing was ever fetched', () => {
    expect(isStale(null, now)).toBe(true);
  });

  it('is fresh right after a fetch', () => {
    expect(isStale(now, now)).toBe(false);
  });

  it('is fresh up to exactly 30 seconds and stale after', () => {
    expect(isStale(now - STALE_AFTER_MS, now)).toBe(false);
    expect(isStale(now - STALE_AFTER_MS - 1, now)).toBe(true);
  });

  it('accepts a custom time to live', () => {
    expect(isStale(now - 5_000, now, 1_000)).toBe(true);
  });
});

describe('isPersistedItems', () => {
  it('accepts an object with an items array', () => {
    expect(isPersistedItems({ items: [] })).toBe(true);
    expect(isPersistedItems({ items: [{ id: 'a' }], lastFetchedAt: 1 })).toBe(true);
  });

  it.each([undefined, null, 'text', 42, {}, { items: 'nope' }, { items: null }, []])('rejects %p', (value) => {
    expect(isPersistedItems(value)).toBe(false);
  });
});
