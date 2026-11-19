import { syncOutbox, type SyncOptions } from '../domain/sync';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore, whenOutboxHydrated } from '../stores/outboxStore';
import type { SyncResult } from '../types/sync';
import * as checkinRepository from './checkinRepository';
import { refreshNetworkStatus } from './networkMonitor';

export interface SyncSummary {
  synced: number;
  failed: number;
}

const NOTHING_DONE: SyncSummary = { synced: 0, failed: 0 };

const currentUserId = () => useAuthStore.getState().user?.id ?? null;

// The run that is going right now. Kept here (not in a store) because a promise is not something to render.
let running: { force: boolean; promise: Promise<SyncSummary> } | null = null;

/**
 * Sends everything in the outbox to the server. Triggers (reconnect, app foreground, login, the Retry
 * button) can fire at the same moment, so there is only ever one run: a second caller gets the run
 * that is already going instead of starting its own.
 *
 * One exception: a forced run (Retry) asked for during a normal run is not dropped. The normal run
 * may have skipped that item because of its backoff, so a forced run starts right after it.
 */
export function runSync({ force = false }: SyncOptions = {}): Promise<SyncSummary> {
  if (running) {
    if (!force || running.force) return running.promise;
    return running.promise.then(() => runSync({ force: true }));
  }

  const promise = execute(force).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { force, promise };
  return promise;
}

async function execute(force: boolean): Promise<SyncSummary> {
  const userId = currentUserId();
  if (!userId) return NOTHING_DONE;

  // Ask NetInfo right now instead of trusting the store. At app start the store still says "online"
  // for a moment, and sending then would mark every pending item as failed just because we are offline.
  await refreshNetworkStatus();
  if (!useNetworkStore.getState().isOnline) return NOTHING_DONE;

  await whenOutboxHydrated();
  const items = useOutboxStore.getState().items;
  if (items.length === 0) return NOTHING_DONE;

  const outbox = useOutboxStore.getState();
  outbox.setSyncing(true);
  let result: SyncResult;
  try {
    result = await syncOutbox(items, checkinRepository.createFromOutbox, Date.now(), { force });
  } finally {
    outbox.setSyncing(false);
  }

  // Signed out (or someone else signed in) while we were sending: these results are not theirs to see.
  if (currentUserId() !== userId) return NOTHING_DONE;

  // Insert and remove back to back with no await between. The server copy appears in the same moment
  // the pending copy goes, so the row never flickers. If a screen did render in between, the merged
  // list drops the pending copy anyway because the clientId matches, so it still cannot show twice.
  const checkins = useCheckinsStore.getState();
  checkins.upsertMany(result.synced.map((s) => s.serverCheckin));
  outbox.markSynced(result.synced.map((s) => s.clientId));
  outbox.markFailed(result.failed);
  if (result.synced.length > 0) outbox.setLastSynced(result.synced.length);

  // Quietly refresh the list so it matches the server (edits made on another device, for example).
  if (result.synced.length > 0) void checkins.fetchAll(userId);

  return { synced: result.synced.length, failed: result.failed.length };
}
