import type { Checkin } from '../types/checkin';

let counter = 0;

/** Builds a valid Checkin for tests. Override only the fields the test cares about. */
export function makeCheckin(overrides: Partial<Checkin> = {}): Checkin {
  counter += 1;
  return {
    id: `ck_${counter}`,
    clientId: `client-${counter}`,
    weightKg: 70,
    heightCm: 175,
    sleepHours: 8,
    steps: 5000,
    waterLitres: 2,
    mood: 'happy',
    checkinDate: '2026-01-01',
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
    syncStatus: 'synced',
    ...overrides,
  };
}
