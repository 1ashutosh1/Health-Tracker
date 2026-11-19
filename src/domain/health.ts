import { parseISO } from 'date-fns';

import type { BmiCategory, Checkin, DashboardStats, Trend } from '../types/checkin';
import { formatDecimal } from '../utils/format';

/** Rounds to 1 decimal and never returns -0. */
function round1(value: number): number {
  return Math.round(value * 10) / 10 + 0;
}

/**
 * BMI = kg / m², rounded to 1 decimal.
 * Returns null for anything that is not a positive, finite number, so callers never show NaN.
 */
export function calculateBMI(weightKg: number, heightCm: number): number | null {
  const valid = (n: number) => Number.isFinite(n) && n > 0;
  if (!valid(weightKg) || !valid(heightCm)) return null;
  const heightM = heightCm / 100;
  return round1(weightKg / (heightM * heightM));
}

/** WHO adult cut-offs: <18.5, 18.5-24.9, 25-29.9, >=30. */
export function getBMICategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/**
 * Oldest-first order by checkinDate (the day the user measured, not when the row was created).
 * Same-day check-ins fall back to createdAt so the order is always deterministic.
 */
export function compareCheckins(a: Checkin, b: Checkin): number {
  const byDate = parseISO(a.checkinDate).getTime() - parseISO(b.checkinDate).getTime();
  if (byDate !== 0) return byDate;
  return parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime();
}

const EMPTY_STATS: DashboardStats = {
  current: null,
  starting: null,
  difference: null,
  trend: null,
  bmi: null,
  bmiCategory: null,
  total: 0,
  latestDate: null,
  history: [],
};

/** Everything the Summary screen shows, derived from the check-in list. Input is not mutated. */
export function computeDashboardStats(checkins: readonly Checkin[]): DashboardStats {
  if (checkins.length === 0) return EMPTY_STATS;

  const sorted = [...checkins].sort(compareCheckins);
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  // Rounded first, so the arrow always agrees with the number on screen.
  const difference = round1(latest.weightKg - first.weightKg);
  const trend: Trend = difference > 0 ? 'up' : difference < 0 ? 'down' : 'same';

  const bmi = calculateBMI(latest.weightKg, latest.heightCm);

  return {
    current: latest.weightKg,
    starting: first.weightKg,
    difference,
    trend,
    bmi,
    bmiCategory: bmi === null ? null : getBMICategory(bmi),
    total: sorted.length,
    latestDate: latest.checkinDate,
    history: sorted.map((c) => ({ date: c.checkinDate, weightKg: c.weightKg })),
  };
}

/** Outside this range the form shows a gentle "are you sure?" hint. It never blocks saving. */
export const TYPICAL_SLEEP_HOURS = { min: 3, max: 14 } as const;

export function getSleepWarning(hours: number): string | null {
  if (!Number.isFinite(hours)) return null;
  if (hours < TYPICAL_SLEEP_HOURS.min) return 'That is very little sleep. Double-check the number.';
  if (hours > TYPICAL_SLEEP_HOURS.max) return 'That is a lot of sleep. Double-check the number.';
  return null;
}

/**
 * The sentence under the big weight number: "Down 3.6 kg since you started".
 * `unit` is "kg" on screen and "kilograms" for screen readers.
 */
export function describeTrend(trend: Trend | null, difference: number | null, unit = 'kg'): string {
  if (trend === null || difference === null || trend === 'same') return 'No change yet';
  const amount = formatDecimal(Math.abs(difference));
  return `${trend === 'down' ? 'Down' : 'Up'} ${amount} ${unit} since you started`;
}
