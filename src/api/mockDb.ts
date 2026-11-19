import { addHours, format, startOfDay, subDays } from 'date-fns';

import type { Checkin } from '../types/checkin';

/** A user row as the "server" stores it. The password never leaves the server. */
export interface ServerUser {
  id: string;
  email: string;
  name: string;
  /** Plain text on purpose: this is a mock. A real server would store a hash. */
  password: string;
}

/** A check-in row as the "server" stores it: the public Checkin plus its owner. */
export type ServerCheckin = Checkin & { userId: string };

export interface MockDb {
  users: ServerUser[];
  checkins: ServerCheckin[];
}

export const DEMO_USER_ID = 'user_demo';
export const NEW_USER_ID = 'user_new';

// One row per seeded check-in. `daysAgo` keeps the data inside the last 60 days
// whenever the app is first opened, and weight falls slowly from 78 to 74 kg.
const DEMO_ROWS = [
  { daysAgo: 58, weightKg: 78.0, sleepHours: 7.5, steps: 6200, waterLitres: 1.8, mood: 'happy' },
  { daysAgo: 51, weightKg: 77.7, sleepHours: 6.5, steps: 8400, waterLitres: 2.2, mood: 'neutral' },
  { daysAgo: 44, weightKg: 77.2, sleepHours: 8.0, steps: 4300, waterLitres: 2.0, mood: 'happy' },
  {
    daysAgo: 37,
    weightKg: 76.9,
    sleepHours: 5.5,
    steps: 9800,
    waterLitres: 1.5,
    mood: 'sad',
    notes: 'Slept badly, long day at work.',
  },
  { daysAgo: 30, weightKg: 76.3, sleepHours: 7.0, steps: 7100, waterLitres: 2.5, mood: 'neutral' },
  { daysAgo: 23, weightKg: 76.4, sleepHours: 6.0, steps: 3900, waterLitres: 2.0, mood: 'sad' },
  {
    daysAgo: 16,
    weightKg: 75.5,
    sleepHours: 8.5,
    steps: 11200,
    waterLitres: 2.8,
    mood: 'happy',
    notes: 'Went for a long run.',
  },
  { daysAgo: 10, weightKg: 75.0, sleepHours: 7.5, steps: 8800, waterLitres: 2.4, mood: 'neutral' },
  { daysAgo: 5, weightKg: 74.5, sleepHours: 6.5, steps: 6500, waterLitres: 2.1, mood: 'happy' },
  { daysAgo: 1, weightKg: 74.0, sleepHours: 7.5, steps: 9300, waterLitres: 2.6, mood: 'happy' },
] as const;

/** The database a fresh install of the mock server starts with. `now` is a parameter so tests are stable. */
export function buildSeedDb(now: Date = new Date()): MockDb {
  const checkins: ServerCheckin[] = DEMO_ROWS.map((row, index) => {
    const day = startOfDay(subDays(now, row.daysAgo));
    // Measured at 8 in the morning.
    const stamp = addHours(day, 8).toISOString();
    return {
      id: `ck_seed_${index + 1}`,
      clientId: `seed-client-${index + 1}`,
      userId: DEMO_USER_ID,
      weightKg: row.weightKg,
      heightCm: 172,
      sleepHours: row.sleepHours,
      steps: row.steps,
      waterLitres: row.waterLitres,
      mood: row.mood,
      notes: 'notes' in row ? row.notes : undefined,
      checkinDate: format(day, 'yyyy-MM-dd'),
      createdAt: stamp,
      updatedAt: stamp,
      syncStatus: 'synced',
    };
  });

  return {
    users: [
      { id: DEMO_USER_ID, email: 'demo@health.app', name: 'Demo User', password: 'Password123' },
      // No check-ins on purpose: used to demo the empty states.
      { id: NEW_USER_ID, email: 'new@health.app', name: 'New User', password: 'Password123' },
    ],
    checkins,
  };
}

/** Guards data read back from storage: anything unexpected means "start again from the seed". */
export function isMockDb(value: unknown): value is MockDb {
  if (typeof value !== 'object' || value === null) return false;
  const db = value as Partial<MockDb>;
  return Array.isArray(db.users) && Array.isArray(db.checkins);
}
