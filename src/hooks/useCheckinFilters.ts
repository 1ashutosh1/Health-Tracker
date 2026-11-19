import { useShallow } from 'zustand/react/shallow';

import { hasActiveFilters } from '../domain/filters';
import { useFilterStore } from '../stores/filterStore';

/** The list's filters and the actions that change them. Lives in a store so it survives navigation. */
export function useCheckinFilters() {
  const filters = useFilterStore(
    useShallow((s) => ({ sort: s.sort, moods: s.moods, from: s.from, to: s.to })),
  );
  const actions = useFilterStore(
    useShallow((s) => ({
      setSort: s.setSort,
      toggleMood: s.toggleMood,
      setFrom: s.setFrom,
      setTo: s.setTo,
      clearFilters: s.clearFilters,
    })),
  );

  return { filters, isFiltering: hasActiveFilters(filters), ...actions };
}
