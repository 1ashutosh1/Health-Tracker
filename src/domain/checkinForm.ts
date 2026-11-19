import { isValid, parseISO } from 'date-fns';

import type { Checkin } from '../types/checkin';
import { toDateString } from '../utils/format';
import type { CheckinFormValues } from './validation';
import { compareCheckins } from './health';

/** The most recent check-in by checkinDate, or null for an empty list. */
export function getLatestCheckin(checkins: readonly Checkin[]): Checkin | null {
  let latest: Checkin | null = null;
  for (const checkin of checkins) {
    if (latest === null || compareCheckins(checkin, latest) > 0) latest = checkin;
  }
  return latest;
}

/**
 * Starting values for a new check-in: today's date, and the height from the latest
 * check-in (height rarely changes, so there is no need to type it every time).
 * Mood stays unset so the user has to choose one.
 */
export function getCreateDefaults(
  latest: Pick<Checkin, 'heightCm'> | null,
  today: Date = new Date(),
): Partial<CheckinFormValues> {
  return {
    weightKg: '',
    heightCm: latest ? String(latest.heightCm) : '',
    sleepHours: '',
    steps: '',
    waterLitres: '',
    notes: '',
    checkinDate: toDateString(today),
  };
}

/** Turns a saved check-in back into the strings the form inputs hold. */
export function checkinToFormValues(checkin: Checkin): CheckinFormValues {
  const date = parseISO(checkin.checkinDate);
  return {
    weightKg: String(checkin.weightKg),
    heightCm: String(checkin.heightCm),
    sleepHours: String(checkin.sleepHours),
    steps: String(checkin.steps),
    waterLitres: String(checkin.waterLitres),
    mood: checkin.mood,
    notes: checkin.notes ?? '',
    // A full timestamp becomes its local calendar day, which is what the date field edits.
    checkinDate: isValid(date) ? toDateString(date) : checkin.checkinDate,
  };
}
