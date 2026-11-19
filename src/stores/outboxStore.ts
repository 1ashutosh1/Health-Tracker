import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isPersistedItems } from '../domain/cache';
import { STORAGE_KEYS } from '../storage/keys';
import type { Checkin, CheckinFields } from '../types/checkin';
import type { FailedItem } from '../types/sync';

/**
 * Check-ins created on this device that the server has not accepted yet, saved to disk so they
 * survive a restart. Every item is 'pending' (waiting) or 'failed' (the last attempt was rejected).
 * An item leaves the outbox only when the server has it (`markSynced`) or the user deletes it.
 */
interface OutboxState {
  items: Checkin[];
  /** False until the saved outbox has been read from disk. Syncing must wait for it. */
  hasHydrated: boolean;
  /** True while a sync run is sending items. Not saved. Editing a pending item is blocked meanwhile. */
  isSyncing: boolean;
  /** Set after a sync that sent something, so the UI can say "Synced 2 check-ins". Not saved. */
  lastSynced: { count: number; at: number } | null;

  add: (item: Checkin) => void;
  /** Edits a pending item. A failed item goes back to 'pending' with a clean slate, so it retries at once. */
  update: (clientId: string, changes: Partial<CheckinFields>) => Checkin | null;
  remove: (clientId: string) => void;
  markFailed: (failures: readonly FailedItem[]) => void;
  /** Takes the items out of the outbox: the server has them now. One state change for the whole batch. */
  markSynced: (clientIds: readonly string[]) => void;
  setSyncing: (isSyncing: boolean) => void;
  setLastSynced: (count: number) => void;
  dismissLastSynced: () => void;
  /** Back to empty (used on logout). */
  reset: () => void;
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      isSyncing: false,
      lastSynced: null,

      add: (item) => set(({ items }) => ({ items: [...items, item] })),

      update: (clientId, changes) => {
        const current = get().items.find((c) => c.clientId === clientId);
        if (!current) return null;

        // Explicit fields instead of a spread of `current`, so the backoff and error state is dropped.
        const { syncError: _error, syncAttempts: _attempts, nextRetryAt: _next, ...rest } = current;
        const updated: Checkin = {
          ...rest,
          ...changes,
          syncStatus: 'pending',
          updatedAt: new Date().toISOString(),
        };
        set(({ items }) => ({ items: items.map((c) => (c.clientId === clientId ? updated : c)) }));
        return updated;
      },

      remove: (clientId) => set(({ items }) => ({ items: items.filter((c) => c.clientId !== clientId) })),

      markFailed: (failures) => {
        if (failures.length === 0) return;
        const byClientId = new Map(failures.map((f) => [f.clientId, f]));
        set(({ items }) => ({
          items: items.map((item) => {
            const failure = byClientId.get(item.clientId);
            if (!failure) return item;
            return {
              ...item,
              syncStatus: 'failed',
              syncError: failure.error,
              syncAttempts: failure.attempts,
              nextRetryAt: failure.nextRetryAt,
            };
          }),
        }));
      },

      markSynced: (clientIds) => {
        if (clientIds.length === 0) return;
        const done = new Set(clientIds);
        set(({ items }) => ({ items: items.filter((c) => !done.has(c.clientId)) }));
      },

      setSyncing: (isSyncing) => set({ isSyncing }),
      setLastSynced: (count) => set({ lastSynced: { count, at: Date.now() } }),
      dismissLastSynced: () => set({ lastSynced: null }),

      reset: () => set({ items: [], isSyncing: false, lastSynced: null }),
    }),
    {
      name: STORAGE_KEYS.outbox,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ items }) => ({ items }),
      // Only `items` is taken from the file; anything else in it is ignored.
      merge: (persisted, current) =>
        isPersistedItems(persisted) ? { ...current, items: persisted.items as Checkin[] } : current,
      onRehydrateStorage: () => () => {
        // Runs whether or not reading worked. A broken outbox file must not block syncing forever.
        useOutboxStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Resolves once the saved outbox has been loaded (or loading it failed). */
export function whenOutboxHydrated(): Promise<void> {
  if (useOutboxStore.getState().hasHydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useOutboxStore.subscribe((state) => {
      if (!state.hasHydrated) return;
      unsubscribe();
      resolve();
    });
  });
}
