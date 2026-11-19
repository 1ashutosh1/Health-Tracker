import type { Checkin } from './checkin';

/** An outbox item the server accepted. `serverCheckin` has the real id ("ck_...") and syncStatus 'synced'. */
export interface SyncedItem {
  clientId: string;
  serverCheckin: Checkin;
}

/** An outbox item that could not be sent. It stays in the outbox and is retried after `nextRetryAt`. */
export interface FailedItem {
  clientId: string;
  /** A message that is safe to show. */
  error: string;
  /** How many times sending has failed in total, including this one. */
  attempts: number;
  /** Epoch ms. */
  nextRetryAt: number;
}

export interface SyncResult {
  synced: SyncedItem[];
  failed: FailedItem[];
}

/** Sends one outbox item to the server. Must be idempotent on `clientId`. */
export type CreateRemote = (item: Checkin) => Promise<Checkin>;
