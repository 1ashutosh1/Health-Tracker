import { randomUUID } from 'expo-crypto';

import * as checkinsApi from '../api/checkinsApi';
import type { UpdateCheckinRequest } from '../types/api';
import type { Checkin, CheckinFields } from '../types/checkin';
import { withRetry } from '../utils/retry';

/**
 * The one place the app reads and writes check-ins. Hooks and stores call this, never the api directly.
 *
 * Retry policy: only reads are retried automatically. A write that failed halfway might or might not
 * have reached the server, so retrying it here could do the same thing twice. Writes surface their
 * error instead. The user taps Retry, and (in the offline phase) the sync engine retries safely
 * because creates carry a `clientId` the server dedupes on.
 */

export function getAll(): Promise<Checkin[]> {
  return withRetry(() => checkinsApi.getCheckins());
}

export function getById(id: string): Promise<Checkin> {
  return withRetry(() => checkinsApi.getCheckin(id));
}

/**
 * `clientId` is made once, here, per call. Later phases keep it with the saved copy
 * so that sending the same check-in again never creates a second one.
 */
export function create(fields: CheckinFields): Promise<Checkin> {
  return checkinsApi.createCheckin({ ...fields, clientId: randomUUID() });
}

export function update(id: string, changes: UpdateCheckinRequest): Promise<Checkin> {
  return checkinsApi.updateCheckin(id, changes);
}

export function remove(id: string): Promise<void> {
  return checkinsApi.deleteCheckin(id);
}
