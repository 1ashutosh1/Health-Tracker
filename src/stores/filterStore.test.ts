import { useFilterStore } from './filterStore';

const state = () => useFilterStore.getState();

beforeEach(() => state().reset());

describe('filterStore', () => {
  it('starts with latest-first and no filters', () => {
    expect(state()).toMatchObject({ sort: 'latest', moods: [], from: undefined, to: undefined });
  });

  it('toggles moods on and off (multi-select)', () => {
    state().toggleMood('happy');
    state().toggleMood('sad');
    expect(state().moods).toEqual(['happy', 'sad']);
    state().toggleMood('happy');
    expect(state().moods).toEqual(['sad']);
  });

  it('dragging "from" past "to" moves "to" with it', () => {
    state().setTo(new Date(2026, 0, 10));
    state().setFrom(new Date(2026, 0, 20));
    expect(state().from).toEqual(new Date(2026, 0, 20));
    expect(state().to).toEqual(new Date(2026, 0, 20));
  });

  it('dragging "to" before "from" moves "from" with it', () => {
    state().setFrom(new Date(2026, 0, 10));
    state().setTo(new Date(2026, 0, 5));
    expect(state().from).toEqual(new Date(2026, 0, 5));
    expect(state().to).toEqual(new Date(2026, 0, 5));
  });

  it('allows a valid range and a single open end', () => {
    state().setFrom(new Date(2026, 0, 1));
    expect(state().to).toBeUndefined();
    state().setTo(new Date(2026, 0, 31));
    expect(state().from).toEqual(new Date(2026, 0, 1));
    expect(state().to).toEqual(new Date(2026, 0, 31));
  });

  it('clearFilters removes moods and dates but keeps the sort order', () => {
    state().setSort('oldest');
    state().toggleMood('happy');
    state().setFrom(new Date(2026, 0, 1));
    state().clearFilters();
    expect(state()).toMatchObject({ sort: 'oldest', moods: [], from: undefined, to: undefined });
  });

  it('reset also restores the sort order', () => {
    state().setSort('oldest');
    state().reset();
    expect(state().sort).toBe('latest');
  });
});
