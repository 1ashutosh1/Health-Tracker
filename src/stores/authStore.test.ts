import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';

import { devConfig, resetMockServer } from '../api/mockServer';
import { STORAGE_KEYS } from '../storage/keys';
import { getToken } from '../storage/secureStorage';
import { getItem } from '../storage/storage';
import type { User } from '../types/auth';
import { makeCheckin } from '../test-utils/makeCheckin';
import { useAuthStore } from './authStore';
import { useCheckinsStore } from './checkinsStore';
import { useFilterStore } from './filterStore';
import { useOutboxStore } from './outboxStore';

const demo = { email: 'demo@health.app', password: 'Password123' };

beforeEach(async () => {
  await AsyncStorage.clear();
  await resetMockServer();
  devConfig.latencyMs = { min: 0, max: 0 };
  devConfig.failureRate = 0;
  devConfig.forceOffline = false;
  useAuthStore.setState({ status: 'hydrating', user: null, token: null, pendingDeepLink: null });
  // Clear any token a previous test left in the (mocked) keychain.
  const SecureStore = jest.requireMock('expo-secure-store');
  await SecureStore.deleteItemAsync('ht.auth-token');
});

describe('authStore', () => {
  it('starts hydrating', () => {
    expect(useAuthStore.getState().status).toBe('hydrating');
  });

  it('hydrates to signedOut when nothing is saved', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null, token: null });
  });

  it('login stores the token securely and the user in AsyncStorage, then signs in', async () => {
    await useAuthStore.getState().login(demo);

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.user?.email).toBe('demo@health.app');
    expect(await getToken()).toBe(state.token);
    expect(await getItem<User>(STORAGE_KEYS.authUser)).toEqual(state.user);
    // The token must not be in plain storage.
    expect(await AsyncStorage.getAllKeys()).not.toContain('ht.auth-token');
  });

  it('a failed login throws and leaves the user signed out with nothing saved', async () => {
    await useAuthStore.getState().hydrate();
    await expect(useAuthStore.getState().login({ ...demo, password: 'wrong-password' })).rejects.toMatchObject({
      message: 'Incorrect email or password',
    });
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await getToken()).toBeNull();
  });

  it('restores the session on the next launch (hydrate after login)', async () => {
    await useAuthStore.getState().login(demo);
    const { token, user } = useAuthStore.getState();

    // Simulate killing the app: in-memory state is gone, storage remains.
    useAuthStore.setState({ status: 'hydrating', user: null, token: null });
    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', token, user });
  });

  it('logout clears the token and user, and stays signed out after a restart', async () => {
    await useAuthStore.getState().login(demo);
    await useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', user: null, token: null });
    expect(await getToken()).toBeNull();
    expect(await getItem(STORAGE_KEYS.authUser)).toBeNull();

    useAuthStore.setState({ status: 'hydrating' });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('treats half a session (token without user) as signed out and cleans up', async () => {
    await useAuthStore.getState().login(demo);
    await AsyncStorage.removeItem(STORAGE_KEYS.authUser);

    useAuthStore.setState({ status: 'hydrating', user: null, token: null });
    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await getToken()).toBeNull();
  });

  it('reset() returns to the signed-out state and drops the pending deep link', () => {
    useAuthStore.setState({ status: 'signedIn', pendingDeepLink: 'ck_1' });
    useAuthStore.getState().reset();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', pendingDeepLink: null });
  });

  it('setPendingDeepLink remembers a check-in id across the login', async () => {
    useAuthStore.getState().setPendingDeepLink('ck_1');
    await useAuthStore.getState().login(demo);
    expect(useAuthStore.getState().pendingDeepLink).toBe('ck_1');
  });

  it("logout wipes the previous user's check-ins and filters so the next account never sees them", async () => {
    await useAuthStore.getState().login(demo);
    useCheckinsStore.getState().upsert(makeCheckin());
    useFilterStore.getState().toggleMood('sad');

    await useAuthStore.getState().logout();

    expect(useCheckinsStore.getState().items).toEqual([]);
    expect(useFilterStore.getState().moods).toEqual([]);
  });

  it("logout also empties the outbox, so one account's unsynced check-ins are never sent to the next", async () => {
    await useAuthStore.getState().login(demo);
    useOutboxStore.getState().add(makeCheckin({ id: 'local_x', clientId: 'x', syncStatus: 'pending' }));

    await useAuthStore.getState().logout();

    expect(useOutboxStore.getState().items).toEqual([]);
  });

  it("logout deletes the saved check-in cache and outbox from disk, so the next launch cannot read them", async () => {
    await useAuthStore.getState().login(demo);
    useCheckinsStore.getState().upsert(makeCheckin());
    useOutboxStore.getState().add(makeCheckin({ id: 'local_x', clientId: 'x', syncStatus: 'pending' }));
    // The persist middleware writes asynchronously. Wait until both really are on disk.
    await waitFor(async () => {
      expect(await AsyncStorage.getAllKeys()).toEqual(
        expect.arrayContaining([STORAGE_KEYS.checkinsCache, STORAGE_KEYS.outbox]),
      );
    });

    await useAuthStore.getState().logout();

    await waitFor(async () => {
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).not.toContain(STORAGE_KEYS.checkinsCache);
      expect(keys).not.toContain(STORAGE_KEYS.outbox);
      expect(keys).not.toContain(STORAGE_KEYS.authUser);
    });
  });
});
