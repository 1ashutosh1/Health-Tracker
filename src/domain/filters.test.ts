import { makeCheckin } from '../test-utils/makeCheckin';
import type { CheckinFilters } from '../types/checkin';
import { applyFilters, hasActiveFilters } from './filters';

const jan1 = makeCheckin({ id: 'jan1', mood: 'happy', checkinDate: '2026-01-01' });
const jan15 = makeCheckin({ id: 'jan15', mood: 'sad', checkinDate: '2026-01-15' });
const feb1 = makeCheckin({ id: 'feb1', mood: 'neutral', checkinDate: '2026-02-01' });
const mar1 = makeCheckin({ id: 'mar1', mood: 'happy', checkinDate: '2026-03-01' });
// Deliberately unsorted.
const all = [feb1, jan1, mar1, jan15];

const base: CheckinFilters = { sort: 'latest', moods: [] };
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe('applyFilters: sorting', () => {
  it('sorts latest first by checkinDate', () => {
    expect(ids(applyFilters(all, { ...base, sort: 'latest' }))).toEqual(['mar1', 'feb1', 'jan15', 'jan1']);
  });

  it('sorts oldest first by checkinDate', () => {
    expect(ids(applyFilters(all, { ...base, sort: 'oldest' }))).toEqual(['jan1', 'jan15', 'feb1', 'mar1']);
  });

  it('sorts by checkinDate, not createdAt', () => {
    const backfilled = makeCheckin({
      id: 'backfilled',
      checkinDate: '2026-01-01',
      createdAt: '2026-06-01T08:00:00.000Z',
    });
    const recent = makeCheckin({ id: 'recent', checkinDate: '2026-02-01', createdAt: '2026-02-01T08:00:00.000Z' });
    expect(ids(applyFilters([backfilled, recent], { ...base, sort: 'latest' }))).toEqual(['recent', 'backfilled']);
  });

  it('orders same-day check-ins by createdAt, and flips them with the sort', () => {
    const morning = makeCheckin({ id: 'morning', checkinDate: '2026-02-01', createdAt: '2026-02-01T07:00:00.000Z' });
    const evening = makeCheckin({ id: 'evening', checkinDate: '2026-02-01', createdAt: '2026-02-01T20:00:00.000Z' });
    expect(ids(applyFilters([morning, evening], { ...base, sort: 'latest' }))).toEqual(['evening', 'morning']);
    expect(ids(applyFilters([evening, morning], { ...base, sort: 'oldest' }))).toEqual(['morning', 'evening']);
  });

  it('keeps every item when two have the same date and createdAt', () => {
    const a = makeCheckin({ id: 'a', checkinDate: '2026-02-01', createdAt: '2026-02-01T07:00:00.000Z' });
    const b = makeCheckin({ id: 'b', checkinDate: '2026-02-01', createdAt: '2026-02-01T07:00:00.000Z' });
    expect(applyFilters([a, b], base)).toHaveLength(2);
  });

  it('does not mutate the input array', () => {
    const input = [...all];
    applyFilters(input, base);
    expect(input).toEqual(all);
  });
});

describe('applyFilters: edge cases', () => {
  it('returns [] for an empty list', () => {
    expect(applyFilters([], { ...base, moods: ['happy'], from: new Date(2026, 0, 1) })).toEqual([]);
  });

  it('returns the single item when it matches', () => {
    expect(applyFilters([jan1], base)).toEqual([jan1]);
  });

  it('returns a new array even when nothing is filtered out', () => {
    expect(applyFilters(all, base)).not.toBe(all);
  });
});

describe('applyFilters: moods', () => {
  it('treats an empty mood list as "all moods"', () => {
    expect(applyFilters(all, { ...base, moods: [] })).toHaveLength(4);
  });

  it('keeps only the selected mood', () => {
    expect(ids(applyFilters(all, { ...base, moods: ['happy'] }))).toEqual(['mar1', 'jan1']);
  });

  it('keeps any of several selected moods', () => {
    expect(ids(applyFilters(all, { ...base, moods: ['sad', 'neutral'] }))).toEqual(['feb1', 'jan15']);
  });

  it('returns [] when no check-in has the selected mood', () => {
    expect(applyFilters([jan1, mar1], { ...base, moods: ['sad'] })).toEqual([]);
  });
});

describe('applyFilters: date range (inclusive by day)', () => {
  it('includes check-ins on the from and to days', () => {
    const result = applyFilters(all, { ...base, from: new Date(2026, 0, 15), to: new Date(2026, 1, 1) });
    expect(ids(result)).toEqual(['feb1', 'jan15']);
  });

  it('ignores the time of day on from and to', () => {
    const result = applyFilters(all, {
      ...base,
      from: new Date(2026, 0, 15, 23, 59), // late on Jan 15 still includes Jan 15
      to: new Date(2026, 1, 1, 0, 0, 1), // early on Feb 1 still includes Feb 1
    });
    expect(ids(result)).toEqual(['feb1', 'jan15']);
  });

  it('includes a check-in logged late in the day on the "to" day', () => {
    const lateEvening = makeCheckin({ id: 'late', checkinDate: '2026-02-01T23:30:00' });
    expect(ids(applyFilters([lateEvening], { ...base, to: new Date(2026, 1, 1) }))).toEqual(['late']);
  });

  it('excludes the day before from and the day after to', () => {
    const result = applyFilters(all, { ...base, from: new Date(2026, 0, 2), to: new Date(2026, 0, 31) });
    expect(ids(result)).toEqual(['jan15']);
  });

  it('supports an open-ended range with only from', () => {
    expect(ids(applyFilters(all, { ...base, from: new Date(2026, 1, 1) }))).toEqual(['mar1', 'feb1']);
  });

  it('supports an open-ended range with only to', () => {
    expect(ids(applyFilters(all, { ...base, to: new Date(2026, 0, 15) }))).toEqual(['jan15', 'jan1']);
  });

  it('matches a single day when from and to are the same day', () => {
    const sameDay = new Date(2026, 0, 15);
    expect(ids(applyFilters(all, { ...base, from: sameDay, to: sameDay }))).toEqual(['jan15']);
  });

  it('returns every same-day check-in for a single-day range', () => {
    const a = makeCheckin({ id: 'a', checkinDate: '2026-02-01', createdAt: '2026-02-01T07:00:00.000Z' });
    const b = makeCheckin({ id: 'b', checkinDate: '2026-02-01', createdAt: '2026-02-01T20:00:00.000Z' });
    const day = new Date(2026, 1, 1);
    expect(ids(applyFilters([a, b], { ...base, from: day, to: day }))).toEqual(['b', 'a']);
  });

  it('matches nothing when from is after to', () => {
    expect(applyFilters(all, { ...base, from: new Date(2026, 2, 1), to: new Date(2026, 0, 1) })).toEqual([]);
  });
});

describe('applyFilters: combined', () => {
  it('applies mood, range and sort together', () => {
    const result = applyFilters(all, {
      sort: 'oldest',
      moods: ['happy'],
      from: new Date(2026, 0, 10),
      to: new Date(2026, 11, 31),
    });
    expect(ids(result)).toEqual(['mar1']);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default filters, whatever the sort order', () => {
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, sort: 'oldest' })).toBe(false);
  });

  it('is true when a mood or either date end is set', () => {
    expect(hasActiveFilters({ ...base, moods: ['sad'] })).toBe(true);
    expect(hasActiveFilters({ ...base, from: new Date(2026, 0, 1) })).toBe(true);
    expect(hasActiveFilters({ ...base, to: new Date(2026, 0, 1) })).toBe(true);
  });
});
