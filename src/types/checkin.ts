export const MOODS = ['happy', 'neutral', 'sad'] as const;
export type Mood = (typeof MOODS)[number];

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface Checkin {
  /** Server id "ck_..." or local id "local_<uuid>" until the server has seen it. */
  id: string;
  /** Generated on the device. Idempotency key: the server dedupes on it. */
  clientId: string;
  weightKg: number;
  heightCm: number;
  /** 0-24. The UI warns below 3 or above 14. */
  sleepHours: number;
  /** Integer >= 0. */
  steps: number;
  /** > 0 and <= 10. */
  waterLitres: number;
  mood: Mood;
  /** Max 500 characters. */
  notes?: string;
  /** ISO date ("2026-11-19" or a full ISO timestamp). Never in the future. */
  checkinDate: string;
  createdAt: string;
  updatedAt: string;
  /** Server items are always 'synced'. */
  syncStatus: SyncStatus;
  syncError?: string;
  syncAttempts?: number;
  /** Outbox items only: epoch ms before which the sync engine will not try again (backoff). */
  nextRetryAt?: number;
}

/** The fields a user fills in on the form. Everything else is set by the app or the server. */
export type CheckinFields = Pick<
  Checkin,
  'weightKg' | 'heightCm' | 'sleepHours' | 'steps' | 'waterLitres' | 'mood' | 'notes' | 'checkinDate'
>;

export type BmiCategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese';

/** 'same' for a single check-in or no change; null when there is no data at all. */
export type Trend = 'up' | 'down' | 'same';

export interface WeightPoint {
  date: string;
  weightKg: number;
}

/** Time window of the weight chart: past week, past month, past 6 months, or everything. */
export type ChartRange = 'W' | 'M' | '6M' | 'All';

export interface DashboardStats {
  /** Weight of the most recent check-in. */
  current: number | null;
  /** Weight of the earliest check-in. */
  starting: number | null;
  /** current - starting, rounded to 1 decimal. */
  difference: number | null;
  trend: Trend | null;
  /** BMI from the latest check-in's weight and height. */
  bmi: number | null;
  bmiCategory: BmiCategory | null;
  total: number;
  latestDate: string | null;
  /** One point per check-in, oldest first. */
  history: WeightPoint[];
}

export type SortOrder = 'latest' | 'oldest';

export interface CheckinFilters {
  sort: SortOrder;
  /** Empty means "all moods". */
  moods: Mood[];
  /** Inclusive, compared by calendar day. */
  from?: Date;
  to?: Date;
}
