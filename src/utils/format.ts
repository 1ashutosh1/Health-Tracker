import { format, isValid, parseISO } from 'date-fns';

import type { Mood } from '../types/checkin';

/** "72.4": at most one decimal, no trailing ".0". */
export function formatDecimal(value: number, maxDecimals = 1): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

/** "8,200" */
export function formatSteps(steps: number): string {
  return steps.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** "Thu, Nov 19, 2026". Falls back to the raw text if the date cannot be parsed, so nothing renders "Invalid Date". */
export function formatCheckinDate(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, 'EEE, MMM d, yyyy') : iso;
}

/** "Nov 19", for tight places such as filter chips. */
export function formatShortDate(date: Date): string {
  return format(date, 'MMM d');
}

/** The value stored in `checkinDate`: the calendar day in local time, e.g. "2026-11-19". */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export const MOOD_LABELS: Record<Mood, string> = {
  happy: 'Happy',
  neutral: 'Neutral',
  sad: 'Sad',
};
