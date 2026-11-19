import AsyncStorage from '@react-native-async-storage/async-storage';

import * as checkinsApi from '../api/checkinsApi';
import { devConfig, resetMockServer } from '../api/mockServer';
import { mergeWithOutbox } from '../domain/sync';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import type { CheckinFields } from '../types/checkin';
import * as repository from './checkinRepository';
import { runSync } from './syncService';

/**
 * The checkpoint scenarios from the plan, end to end: real mock server, repository, stores and sync
 * engine. Only the phone's connection is simulated (networkStore + devConfig).
 */

// Native crypto does not exist in Jest. Both the repository (clientId) and the mock server (ck_ ids) need unique values.
let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuidCounter}` }));

const demo = { email: 'demo@health.app', password: 'Password123' };

const fields = (checkinDate: string, weightKg = 72): CheckinFields => ({
  weightKg,
  heightCm: 175,
  sleepHours: 7,
  steps: 5000,
  waterLitres: 2,
  mood: 'happy',
  checkinDate,
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const serverCount = async () => (await checkinsApi.getCheckins()).length;
const outbox = () => useOutboxStore.getState().items;
const shown = () => mergeWithOutbox(outbox(), useCheckinsStore.getState().items);

const goOffline = () => useNetworkStore.setState({ isOnline: false });
const goOnline = () => useNetworkStore.setState({ isOnline: true });

let baseline = 0;

beforeEach(async () => {
  await AsyncStorage.clear();
  await resetMockServer();
  devConfig.latencyMs = { min: 0, max: 0 };
  devConfig.failureRate = 0;
  devConfig.forceOffline = false;
  useOutboxStore.getState().reset();
  useCheckinsStore.getState().reset();
  useCheckinsStore.setState({ hasHydrated: true });
  useOutboxStore.setState({ hasHydrated: true });
  goOnline();
  await useAuthStore.getState().login(demo);
  baseline = await serverCount();
  await useCheckinsStore.getState().fetchAll(useAuthStore.getState().user?.id ?? '');
});

afterEach(() => {
  devConfig.failureRate = 0;
  devConfig.forceOffline = false;
});

describe('offline create, then reconnect', () => {
  it('queues two check-ins offline, then syncs both once, with no duplicates after a second run', async () => {
    goOffline();
    await repository.create(fields('2026-11-17', 71));
    await repository.create(fields('2026-11-18', 70));

    // They show at once as pending, and the server has not heard of them.
    expect(outbox().map((c) => c.syncStatus)).toEqual(['pending', 'pending']);
    expect(shown()).toHaveLength(baseline + 2);
    expect(await serverCount()).toBe(baseline);

    goOnline();
    await expect(runSync({ force: true })).resolves.toEqual({ synced: 2, failed: 0 });

    expect(outbox()).toEqual([]);
    expect(await serverCount()).toBe(baseline + 2);
    expect(shown()).toHaveLength(baseline + 2);
    expect(shown().every((c) => c.syncStatus === 'synced')).toBe(true);
    expect(useOutboxStore.getState().lastSynced?.count).toBe(2);

    // Like killing and reopening the app, or a second trigger arriving: nothing is created again.
    await runSync({ force: true });
    expect(await serverCount()).toBe(baseline + 2);
  });

  it('sends oldest first', async () => {
    goOffline();
    await repository.create(fields('2026-11-18'));
    await repository.create(fields('2026-11-16'));
    await repository.create(fields('2026-11-17'));
    goOnline();

    await runSync({ force: true });

    const created = (await checkinsApi.getCheckins()).filter(
      (c) => c.checkinDate >= '2026-11-16' && c.checkinDate <= '2026-11-18',
    );
    // The server lists newest first; creation order shows in createdAt.
    expect(created.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((c) => c.checkinDate)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
  });

  it('a create that lost its connection mid-request falls back to the outbox and syncs later without a duplicate', async () => {
    // The phone thinks it is online, but the request cannot get through.
    devConfig.forceOffline = true;
    const created = await repository.create(fields('2026-11-17'));
    expect(created.syncStatus).toBe('pending');
    expect(outbox()).toHaveLength(1);

    devConfig.forceOffline = false;
    await runSync({ force: true });

    expect(await serverCount()).toBe(baseline + 1);
    expect(outbox()).toEqual([]);
  });
});

describe('failed sync and retry', () => {
  it('marks the item failed with a backoff, then Retry (forced) syncs it once the server recovers', async () => {
    goOffline();
    await repository.create(fields('2026-11-17'));
    goOnline();
    devConfig.failureRate = 1;

    await expect(runSync({ force: true })).resolves.toEqual({ synced: 0, failed: 1 });

    expect(outbox()[0]).toMatchObject({ syncStatus: 'failed', syncAttempts: 1 });
    expect(outbox()[0].syncError).toBeTruthy();
    expect(outbox()[0].nextRetryAt).toBeGreaterThan(Date.now());
    expect(shown()).toHaveLength(baseline + 1); // still visible, still counted

    // Coming back to the app inside the backoff window does not hammer the server.
    devConfig.failureRate = 0;
    await runSync();
    expect(outbox()).toHaveLength(1);

    // The Retry button forces it.
    await expect(runSync({ force: true })).resolves.toEqual({ synced: 1, failed: 0 });
    expect(outbox()).toEqual([]);
    expect(await serverCount()).toBe(baseline + 1);
  });

  it('is safe when an earlier attempt did reach the server but its reply was lost', async () => {
    goOffline();
    const pending = await repository.create(fields('2026-11-17'));
    goOnline();
    // The "lost reply": the server already created it from this same clientId.
    await repository.createFromOutbox(pending);
    expect(await serverCount()).toBe(baseline + 1);

    await expect(runSync({ force: true })).resolves.toEqual({ synced: 1, failed: 0 });

    expect(await serverCount()).toBe(baseline + 1); // still one
    expect(outbox()).toEqual([]);
    expect(shown().filter((c) => c.clientId === pending.clientId)).toHaveLength(1);
  });
});

describe('editing and deleting while offline', () => {
  it('edit and delete a pending item: the outbox changes, the server is never contacted', async () => {
    goOffline();
    const pending = await repository.create(fields('2026-11-17', 71));

    await repository.update(pending.id, { weightKg: 69 });
    expect(outbox()[0].weightKg).toBe(69);

    goOnline();
    await runSync({ force: true });
    const stored = (await checkinsApi.getCheckins()).find((c) => c.clientId === pending.clientId);
    expect(stored?.weightKg).toBe(69); // the edited values are what got sent

    goOffline();
    const second = await repository.create(fields('2026-11-18'));
    await repository.remove(second.id);
    expect(outbox()).toEqual([]);
  });

  it('a synced item cannot be edited or deleted offline: clear message, nothing changes', async () => {
    const synced = useCheckinsStore.getState().items[0];
    goOffline();

    await expect(repository.update(synced.id, { weightKg: 1 })).rejects.toThrow(
      "You're offline. Reconnect to edit synced check-ins.",
    );
    await expect(repository.remove(synced.id)).rejects.toThrow("You're offline. Reconnect to edit synced check-ins.");

    goOnline();
    expect(await serverCount()).toBe(baseline);
  });
});

describe('what survives a restart', () => {
  it('pending items are saved to storage', async () => {
    goOffline();
    await repository.create(fields('2026-11-17'));
    await settle();
    const onDisk = await AsyncStorage.getItem('ht:outbox');
    expect(onDisk).not.toBeNull();

    // Simulate the app starting again: memory is empty, and only the file on disk is left.
    useOutboxStore.setState({ items: [] });
    await settle(); // this change writes the empty outbox to disk too, so let it finish...
    await AsyncStorage.setItem('ht:outbox', onDisk ?? ''); // ...then put back what the app had before it was killed
    await useOutboxStore.persist.rehydrate();

    expect(outbox()).toHaveLength(1);
    expect(outbox()[0].syncStatus).toBe('pending');
  });
});
