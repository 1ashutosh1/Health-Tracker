import { randomUUID } from 'expo-crypto';

import * as checkinsApi from '../api/checkinsApi';
import { buildPendingCheckin, isLocalId, toCreateRequest } from '../domain/sync';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import type { UpdateCheckinRequest } from '../types/api';
import type { Checkin, CheckinFields } from '../types/checkin';
import { ApiError, isNetworkError, NetworkError, NotFoundError, OFFLINE_EDIT_MESSAGE } from '../utils/errors';
import { withRetry } from '../utils/retry';

/**
 * The one place the app reads and writes check-ins. Hooks and stores call this, never the api directly.
 *
 * Two kinds of check-in exist. "Synced" ones live on the server (ids "ck_..."). "Pending" ones were made
 * on this device (ids "local_...") and sit in the outbox until the sync engine sends them.
 *
 * Retry policy: only reads are retried automatically. A write that failed halfway might or might not
 * have reached the server, so retrying it here could do the same thing twice. Creates never lose data:
 * if they cannot reach the server they go to the outbox, and the sync engine retries them safely
 * because each carries a `clientId` the server dedupes on.
 */

const isOnline = () => useNetworkStore.getState().isOnline;
const findPending = (id: string) => useOutboxStore.getState().items.find((c) => c.id === id);

export function getAll(): Promise<Checkin[]> {
  return withRetry(() => checkinsApi.getCheckins());
}

export function getById(id: string): Promise<Checkin> {
  if (isLocalId(id)) {
    // The server has never seen this id, so asking it would only give a 404.
    const pending = findPending(id);
    return pending ? Promise.resolve(pending) : Promise.reject(new NotFoundError('Check-in not found'));
  }
  return withRetry(() => checkinsApi.getCheckin(id));
}

/**
 * Saves a new check-in. Online: the server's copy comes back ('synced'). Offline, or the request never
 * reached the server: the check-in is kept in the outbox and comes back as 'pending'.
 * Any other failure (the server said no) is thrown so the form can show it.
 */
export async function create(fields: CheckinFields): Promise<Checkin> {
  const clientId = randomUUID();
  if (!isOnline()) return saveToOutbox(fields, clientId);

  try {
    return await checkinsApi.createCheckin({ ...fields, clientId });
  } catch (error) {
    // Same `clientId` as the request that may or may not have arrived, so a later sync cannot duplicate it.
    if (isNetworkError(error)) return saveToOutbox(fields, clientId);
    throw error;
  }
}

function saveToOutbox(fields: CheckinFields, clientId: string): Checkin {
  const pending = buildPendingCheckin(fields, clientId, new Date().toISOString());
  useOutboxStore.getState().add(pending);
  return pending;
}

/** Sends one outbox item to the server. Used by the sync engine; safe to repeat because of the `clientId`. */
export function createFromOutbox(item: Checkin): Promise<Checkin> {
  return checkinsApi.createCheckin(toCreateRequest(item));
}

/**
 * Throws if this check-in cannot be changed right now. Hooks call it first so nothing is
 * changed on screen before we know the change can happen.
 *  - Pending: always editable, except during the moment it is being sent (the edit would be lost).
 *  - Synced: needs a connection. Changes made offline cannot be merged later; documented limitation.
 */
export function assertEditable(id: string): void {
  if (!isLocalId(id)) {
    if (!isOnline()) throw new NetworkError(OFFLINE_EDIT_MESSAGE);
    return;
  }
  if (!findPending(id)) {
    // The route still has the old local id but the sync finished and the server gave it a new one.
    throw new ApiError(409, 'This check-in just finished syncing. Go back and open it again.');
  }
  if (useOutboxStore.getState().isSyncing) {
    throw new ApiError(409, 'This check-in is being synced right now. Try again in a moment.');
  }
}

export async function update(id: string, changes: UpdateCheckinRequest): Promise<Checkin> {
  assertEditable(id);
  if (!isLocalId(id)) return checkinsApi.updateCheckin(id, changes);

  const pending = findPending(id);
  const updated = pending ? useOutboxStore.getState().update(pending.clientId, changes) : null;
  if (!updated) throw new NotFoundError('Check-in not found');
  return updated;
}

export async function remove(id: string): Promise<void> {
  assertEditable(id);
  if (!isLocalId(id)) return checkinsApi.deleteCheckin(id);

  const pending = findPending(id);
  if (pending) useOutboxStore.getState().remove(pending.clientId);
}
