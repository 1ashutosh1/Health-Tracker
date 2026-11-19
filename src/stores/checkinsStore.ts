import { create } from 'zustand';

import * as checkinRepository from '../services/checkinRepository';
import type { AsyncStatus } from '../types/api';
import type { Checkin } from '../types/checkin';
import { getErrorMessage } from '../utils/errors';

/**
 * The app's copy of the server's check-ins. Every screen reads from here, so the list,
 * the detail screen and (later) the dashboard always agree and update together.
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

  /** Fetches the list for `userId`. Never throws: failures land in `status` and `error`. */
  fetchAll: (userId: string) => Promise<void>;
  /** Replaces the item with the same id, or adds it. */
  upsert: (checkin: Checkin) => void;
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
};

// The request that is running right now. Everyone who asks while it runs gets the same promise,
// so opening three screens at once sends one request. Kept outside the store because a promise is
// not state anyone renders.
let inFlight: { userId: string; promise: Promise<void> } | null = null;

// Bumped on every local change (upsert, remove, reset). If it moved while a request was running,
// the response may be older than that change, so we ask once more instead of overwriting it.
let localVersion = 0;

export const useCheckinsStore = create<CheckinsState>()((set, get) => {
  async function load(userId: string): Promise<void> {
    const isNewOwner = get().ownerUserId !== userId;
    set(
      isNewOwner
        ? { ...INITIAL, ownerUserId: userId, status: 'loading' }
        : { status: 'loading', error: null },
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
      set({ items, status: 'success', error: null, lastFetchedAt: Date.now() });
    } catch (error) {
      if (get().ownerUserId !== userId) return;
      set({ status: 'error', error: getErrorMessage(error) });
    }
  }

  return {
    ...INITIAL,

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
      set(({ items }) => {
        const exists = items.some((c) => c.id === checkin.id);
        return {
          items: exists ? items.map((c) => (c.id === checkin.id ? checkin : c)) : [checkin, ...items],
        };
      });
    },

    removeLocal: (id) => {
      localVersion += 1;
      set(({ items }) => ({ items: items.filter((c) => c.id !== id) }));
    },

    reset: () => {
      localVersion += 1;
      inFlight = null;
      set({ ...INITIAL });
    },
  };
});
