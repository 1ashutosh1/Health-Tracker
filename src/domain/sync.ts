import type { CreateCheckinRequest } from '../types/api';
import type { Checkin, CheckinFields } from '../types/checkin';
import type { CreateRemote, FailedItem, SyncedItem, SyncResult } from '../types/sync';
import { getErrorMessage } from '../utils/errors';

/** Pure sync logic: no stores, no network, no clock. Everything it needs is passed in, so it is easy to test. */

export const LOCAL_ID_PREFIX = 'local_';

/** Retry delay after the 1st failure is 4s, then 8s, 16s, 32s, and never more than a minute. */
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 60_000;

/** True for ids made on the device. The server has never heard of them. */
export const isLocalId = (id: string): boolean => id.startsWith(LOCAL_ID_PREFIX);

/** A check-in saved on the device only, waiting to be sent. */
export function buildPendingCheckin(fields: CheckinFields, clientId: string, nowIso: string): Checkin {
  return {
    ...fields,
    id: `${LOCAL_ID_PREFIX}${clientId}`,
    clientId,
    createdAt: nowIso,
    updatedAt: nowIso,
    syncStatus: 'pending',
  };
}

/** What the server needs to create the check-in. The `clientId` is what makes sending it twice safe. */
export function toCreateRequest(checkin: Checkin): CreateCheckinRequest {
  return {
    clientId: checkin.clientId,
    weightKg: checkin.weightKg,
    heightCm: checkin.heightCm,
    sleepHours: checkin.sleepHours,
    steps: checkin.steps,
    waterLitres: checkin.waterLitres,
    mood: checkin.mood,
    notes: checkin.notes,
    checkinDate: checkin.checkinDate,
  };
}

/**
 * The list every screen shows: outbox items first, then what the server has.
 * If the server already has an outbox item (same `clientId`), the server's copy wins and the outbox
 * copy is dropped. That is what stops a check-in from showing twice while a sync is finishing.
 */
export function mergeWithOutbox(outbox: readonly Checkin[], server: readonly Checkin[]): Checkin[] {
  const seen = new Set(server.map((c) => c.clientId));
  const pending = outbox.filter((c) => {
    if (seen.has(c.clientId)) return false;
    seen.add(c.clientId);
    return true;
  });
  return [...pending, ...server];
}

/** How long to wait after the `attempts`-th failure. */
export function backoffDelayMs(attempts: number): number {
  return Math.min(2 ** attempts * BACKOFF_BASE_MS, BACKOFF_MAX_MS);
}

export interface SyncOptions {
  /** Try items even if their backoff has not run out. Used by the Retry button and on reconnect. */
  force?: boolean;
}

/** Oldest check-in date first, so the server receives them in the order they happened. */
const byCheckinDate = (a: Checkin, b: Checkin) =>
  a.checkinDate.localeCompare(b.checkinDate) || a.createdAt.localeCompare(b.createdAt);

/**
 * Sends outbox items one at a time. One failing item never stops the others.
 * Items still waiting out their backoff are skipped and appear in neither list.
 * Safe to call again after a partial failure: `createFn` is idempotent on `clientId`.
 */
export async function syncOutbox(
  items: readonly Checkin[],
  createFn: CreateRemote,
  now: number,
  { force = false }: SyncOptions = {},
): Promise<SyncResult> {
  const synced: SyncedItem[] = [];
  const failed: FailedItem[] = [];

  const due = items
    .filter((item) => force || item.nextRetryAt === undefined || item.nextRetryAt <= now)
    .sort(byCheckinDate);

  for (const item of due) {
    try {
      synced.push({ clientId: item.clientId, serverCheckin: await createFn(item) });
    } catch (error) {
      const attempts = (item.syncAttempts ?? 0) + 1;
      failed.push({
        clientId: item.clientId,
        error: getErrorMessage(error),
        attempts,
        nextRetryAt: now + backoffDelayMs(attempts),
      });
    }
  }

  return { synced, failed };
}

/** "Synced 1 check-in" / "Synced 2 check-ins". */
export function formatSyncedMessage(count: number): string {
  return `Synced ${count} check-in${count === 1 ? '' : 's'}`;
}
