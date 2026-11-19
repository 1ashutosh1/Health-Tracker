import { useMemo } from 'react';

import { computeDashboardStats } from '../domain/health';
import type { DashboardStats } from '../types/checkin';
import { useCheckins, type UseCheckinsResult } from './useCheckins';

export interface UseDashboardStatsResult extends Omit<UseCheckinsResult, 'data'> {
  stats: DashboardStats;
}

/**
 * Dashboard numbers, derived from the same check-in list every other screen reads.
 * Nothing is stored: when checkinsStore changes (add, edit, delete, refresh), `data` changes
 * and the stats are recomputed, so the dashboard can never disagree with the list.
 */
export function useDashboardStats(): UseDashboardStatsResult {
  const { data, ...query } = useCheckins();
  const stats = useMemo(() => computeDashboardStats(data), [data]);
  return { ...query, stats };
}
