import { endOfDay, parseISO, startOfDay } from 'date-fns';

import type { Checkin, CheckinFilters } from '../types/checkin';
import { compareCheckins } from './health';

/** True if anything narrows the list. Sorting alone does not count: it hides nothing. */
export function hasActiveFilters({ moods, from, to }: CheckinFilters): boolean {
  return moods.length > 0 || from !== undefined || to !== undefined;
}

/**
 * Filters by mood and date range, then sorts. Returns a new array.
 * - No moods selected means every mood.
 * - `from` / `to` are inclusive and compared by calendar day, so a check-in at 23:30 on the `to` day is kept.
 * - A range where `from` is after `to` matches nothing.
 */
export function applyFilters(
  checkins: readonly Checkin[],
  { sort, moods, from, to }: CheckinFilters,
): Checkin[] {
  const start = from ? startOfDay(from).getTime() : -Infinity;
  const end = to ? endOfDay(to).getTime() : Infinity;

  const matching = checkins.filter((c) => {
    if (moods.length > 0 && !moods.includes(c.mood)) return false;
    const day = parseISO(c.checkinDate).getTime();
    return day >= start && day <= end;
  });

  matching.sort(compareCheckins);
  return sort === 'latest' ? matching.reverse() : matching;
}
