import { create } from 'zustand';

import type { CheckinFilters, Mood, SortOrder } from '../types/checkin';

/**
 * The list's filters live here, not in the screen, so they survive navigating to a
 * check-in and back. They are cleared on logout.
 */
interface FilterState extends CheckinFilters {
  setSort: (sort: SortOrder) => void;
  toggleMood: (mood: Mood) => void;
  /** Keeps the range valid: moving one end past the other drags the other end along. */
  setFrom: (from: Date | undefined) => void;
  setTo: (to: Date | undefined) => void;
  /** Removes the mood and date filters. The sort order stays. */
  clearFilters: () => void;
  reset: () => void;
}

const INITIAL: CheckinFilters = { sort: 'latest', moods: [], from: undefined, to: undefined };

export const useFilterStore = create<FilterState>()((set) => ({
  ...INITIAL,

  setSort: (sort) => set({ sort }),

  toggleMood: (mood) =>
    set(({ moods }) => ({
      moods: moods.includes(mood) ? moods.filter((m) => m !== mood) : [...moods, mood],
    })),

  setFrom: (from) =>
    set(({ to }) => ({ from, to: from && to && from > to ? from : to })),

  setTo: (to) =>
    set(({ from }) => ({ to, from: from && to && to < from ? to : from })),

  clearFilters: () => set({ moods: [], from: undefined, to: undefined }),

  reset: () => set({ ...INITIAL }),
}));
