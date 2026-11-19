import { create } from 'zustand';

import * as authApi from '../api/authApi';
import { STORAGE_KEYS } from '../storage/keys';
import { clearToken, getToken, setToken } from '../storage/secureStorage';
import { getItem, removeItem, setItem } from '../storage/storage';
import type { LoginCredentials, User } from '../types/auth';
import { useCheckinsStore } from './checkinsStore';
import { useFilterStore } from './filterStore';
import { useOutboxStore } from './outboxStore';

export type AuthStatus = 'hydrating' | 'signedOut' | 'signedIn';

interface AuthState {
  /** 'hydrating' until we have checked storage for a saved session. The root layout shows the splash until then. */
  status: AuthStatus;
  user: User | null;
  token: string | null;
  /** A deep link that arrived while signed out. Opened after login (used in the deep-link phase). */
  pendingDeepLink: string | null;

  /** Throws the server's error (wrong password, offline, ...) so the caller can show it. */
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  /** Restores a saved session. Safe to call more than once. */
  hydrate: () => Promise<void>;
  setPendingDeepLink: (url: string | null) => void;
  /** Back to the starting state. Other stores get the same method as they are added. */
  reset: () => void;
}

const SIGNED_OUT = {
  status: 'signedOut',
  user: null,
  token: null,
  pendingDeepLink: null,
} as const;

async function clearSavedSession(): Promise<void> {
  await Promise.all([clearToken(), removeItem(STORAGE_KEYS.authUser)]);
}

// The in-flight hydrate, so React strict mode's double effect reads storage only once.
let hydrating: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'hydrating',
  user: null,
  token: null,
  pendingDeepLink: null,

  login: async (credentials) => {
    const session = await authApi.login(credentials);

    // Save before flipping to signedIn, so a kill right after login never leaves a half session.
    const [tokenSaved, userSaved] = await Promise.all([
      setToken(session.token),
      setItem(STORAGE_KEYS.authUser, session.user),
    ]);
    if (!tokenSaved || !userSaved) {
      await clearSavedSession();
      throw new Error('Could not save your session on this device.');
    }

    set({ status: 'signedIn', user: session.user, token: session.token });
  },

  logout: async () => {
    // Clear storage first: if the app is killed mid-logout, the next launch is signed out, not signed in.
    await clearSavedSession();
    // Nothing from this account may be visible to the next one. That includes check-ins that never synced:
    // the outbox is not tied to a user, so it would otherwise be sent to the next account.
    useCheckinsStore.getState().reset();
    useOutboxStore.getState().reset();
    useFilterStore.getState().reset();
    get().reset();
  },

  hydrate: () => {
    hydrating ??= (async () => {
      const [token, user] = await Promise.all([getToken(), getItem<User>(STORAGE_KEYS.authUser)]);

      if (token && user) {
        set({ status: 'signedIn', token, user });
        return;
      }
      // Only half a session (for example a cleared app data): treat it as signed out and tidy up.
      if (token || user) await clearSavedSession();
      set({ status: 'signedOut' });
    })().finally(() => {
      hydrating = null;
    });
    return hydrating;
  },

  setPendingDeepLink: (url) => set({ pendingDeepLink: url }),

  reset: () => set({ ...SIGNED_OUT }),
}));
