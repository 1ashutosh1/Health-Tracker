import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isPersistedItems } from '../domain/cache';
import * as checkinRepository from '../services/checkinRepository';
import { STORAGE_KEYS } from '../storage/keys';
import type { AsyncStatus } from '../types/api';
import type { Checkin } from '../types/checkin';
import { getErrorMessage, isNetworkError } from '../utils/errors';

/**
 * The app's copy of the server's check-ins. Every screen reads from here, so the list,
 * the detail screen and the dashboard always agree and update together.
 * `items`, `lastFetchedAt` and `ownerUserId` are saved to disk, so the app can show them offline.
 */
interface CheckinsState {
  items: Checkin[];
  /** 'loading' is used for both the first load and a refresh. `lastFetchedAt !== null` tells them apart. */
  status: AsyncStatus;
  /** A message that is safe to show. Old `items` stay in place when a refresh fails. */
  error: string | null;
  /** When the last successful fetch finished. null means "never fetched". */
  lastFetchedAt: number | null;
  /** Whose data this is. Results for any other user are thrown away. */
  ownerUserId: string | null;
  /** True if `error` is "no connection" rather than a server problem. Lets screens show the offline banner instead. */
  errorIsNetwork: boolean;
  /** False until the saved copy has been read from disk. Screens must wait before deciding the list is empty. */
  hasHydrated: boolean;

  /** Fetches the list for `userId`. Never throws: failures land in `status` and `error`. */
  fetchAll: (userId: string) => Promise<void>;
  /** Replaces the item with the same id, or adds it. */
  upsert: (checkin: Checkin) => void;
  /** Same as `upsert` for a whole batch, in one state change (used when a sync finishes). */
  upsertMany: (checkins: readonly Checkin[]) => void;
  removeLocal: (id: string) => void;
  /** Back to the starting state (used on logout). Also cancels the effect of any request in flight. */
  reset: () => void;
}

const INITIAL = {
  items: [] as Checkin[],
  status: 'idle' as AsyncStatus,
  error: null,
  lastFetchedAt: null,
  ownerUserId: null,
  errorIsNetwork: false,
};

// The request that is running right now. Everyone who asks while it runs gets the same promise,
// so opening three screens at once sends one request. Kept outside the store because a promise is
// not state anyone renders.
let inFlight: { userId: string; promise: Promise<void> } | null = null;

// Bumped on every local change (upsert, remove, reset). If it moved while a request was running,
// the response may be older than that change, so we ask once more instead of overwriting it.
let localVersion = 0;

function upsertInto(items: Checkin[], checkin: Checkin): Checkin[] {
  return items.some((c) => c.id === checkin.id)
    ? items.map((c) => (c.id === checkin.id ? checkin : c))
    : [checkin, ...items];
}

/** The slice that is written to disk. Fetch state (status, error, inFlight) is rebuilt on each launch. */
type PersistedCache = Pick<CheckinsState, 'items' | 'lastFetchedAt' | 'ownerUserId'>;

export const useCheckinsStore = create<CheckinsState>()(
  persist(
    (set, get) => {
      async function load(userId: string): Promise<void> {
        const isNewOwner = get().ownerUserId !== userId;
        set(
          isNewOwner
            ? { ...INITIAL, ownerUserId: userId, status: 'loading' }
            : { status: 'loading', error: null, errorIsNetwork: false },
        );

        try {
          let items: Checkin[];
          for (let attempt = 0; ; attempt++) {
            const versionAtStart = localVersion;
            items = await checkinRepository.getAll();
            // Logged out (or a different user logged in) while we waited: this data is not theirs.
            if (get().ownerUserId !== userId) return;
            if (versionAtStart === localVersion || attempt >= 1) break;
          }
          set({ items, status: 'success', error: null, errorIsNetwork: false, lastFetchedAt: Date.now() });
        } catch (error) {
          if (get().ownerUserId !== userId) return;
          // Old `items` stay: after a failed refresh (offline included) the cached copy is still the best we have.
          set({ status: 'error', error: getErrorMessage(error), errorIsNetwork: isNetworkError(error) });
        }
      }

      return {
        ...INITIAL,
        hasHydrated: false,

        fetchAll: (userId) => {
          if (inFlight?.userId === userId) return inFlight.promise;

          const promise: Promise<void> = load(userId).finally(() => {
            if (inFlight?.promise === promise) inFlight = null;
          });
          inFlight = { userId, promise };
          return promise;
        },

        upsert: (checkin) => {
          localVersion += 1;
          set(({ items }) => ({ items: upsertInto(items, checkin) }));
        },

        upsertMany: (checkins) => {
          if (checkins.length === 0) return;
          localVersion += 1;
          set(({ items }) => ({ items: checkins.reduce(upsertInto, items) }));
        },

        removeLocal: (id) => {
          localVersion += 1;
          set(({ items }) => ({ items: items.filter((c) => c.id !== id) }));
        },

        reset: () => {
          localVersion += 1;
          inFlight = null;
          // `hasHydrated` is not in INITIAL: once the disk has been read, logging out does not un-read it.
          set({ ...INITIAL });
        },
      };
    },
    {
      name: STORAGE_KEYS.checkinsCache,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ items, lastFetchedAt, ownerUserId }): PersistedCache => ({ items, lastFetchedAt, ownerUserId }),
      // A cache that is missing or unreadable is the same as no cache: start from the empty state.
      // Only the three saved fields are taken, so a stray key in the file can never become state.
      merge: (persisted, current) => {
        if (!isPersistedItems(persisted)) return current;
        const saved = persisted as Partial<PersistedCache>;
        return {
          ...current,
          items: persisted.items as Checkin[],
          lastFetchedAt: typeof saved.lastFetchedAt === 'number' ? saved.lastFetchedAt : null,
          ownerUserId: typeof saved.ownerUserId === 'string' ? saved.ownerUserId : null,
        };
      },
      onRehydrateStorage: () => () => {
        // Runs whether or not reading worked, so a broken cache can never leave screens waiting forever.
        useCheckinsStore.setState({ hasHydrated: true });
      },
    },
  ),
);
