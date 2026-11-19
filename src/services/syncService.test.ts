import { mergeWithOutbox } from '../domain/sync';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError } from '../utils/errors';
import * as checkinRepository from './checkinRepository';
import { runSync } from './syncService';

jest.mock('./checkinRepository');
// NetInfo is not what is being tested. The real one would ask the (mocked) native module.
jest.mock('./networkMonitor', () => ({ refreshNetworkStatus: jest.fn().mockResolvedValue(undefined) }));
const repository = jest.mocked(checkinRepository);

const outbox = () => useOutboxStore.getState();
const pending = (clientId: string, overrides: Partial<Checkin> = {}) =>
  makeCheckin({ id: `local_${clientId}`, clientId, syncStatus: 'pending', ...overrides });
const serverCopy = (item: Checkin) => ({ ...item, id: `ck_${item.clientId}`, syncStatus: 'synced' as const });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fetchAll = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  fetchAll.mockResolvedValue(undefined);
  repository.createFromOutbox.mockImplementation(async (item) => serverCopy(item));

  outbox().reset();
  useCheckinsStore.getState().reset();
  useCheckinsStore.setState({ fetchAll });
  useNetworkStore.setState({ isOnline: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('runSync', () => {
  it('sends the outbox, moves the server copies into the cache and empties the outbox', async () => {
    outbox().add(pending('a', { checkinDate: '2026-01-01' }));
    outbox().add(pending('b', { checkinDate: '2026-01-02' }));

    const summary = await runSync();

    expect(summary).toEqual({ synced: 2, failed: 0 });
    expect(outbox().items).toEqual([]);
    expect(
      useCheckinsStore
        .getState()
        .items.map((c) => c.id)
        .sort(),
    ).toEqual(['ck_a', 'ck_b']);
    expect(outbox().lastSynced?.count).toBe(2);
  });

  it('refreshes the list from the server afterwards, for this user', async () => {
    outbox().add(pending('a'));

    await runSync();

    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(fetchAll).toHaveBeenCalledWith('u1');
  });

  it('does nothing, and does not fetch, when the outbox is empty', async () => {
    await expect(runSync()).resolves.toEqual({ synced: 0, failed: 0 });

    expect(repository.createFromOutbox).not.toHaveBeenCalled();
    expect(fetchAll).not.toHaveBeenCalled();
    expect(outbox().lastSynced).toBeNull();
  });

  it('keeps failed items in the outbox marked failed, and removes the ones that worked', async () => {
    outbox().add(pending('ok', { checkinDate: '2026-01-01' }));
    outbox().add(pending('bad', { checkinDate: '2026-01-02' }));
    repository.createFromOutbox.mockImplementation(async (item) => {
      if (item.clientId === 'bad') throw new ApiError(500, 'Server error');
      return serverCopy(item);
    });
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    const summary = await runSync();

    expect(summary).toEqual({ synced: 1, failed: 1 });
    expect(outbox().items).toHaveLength(1);
    expect(outbox().items[0]).toMatchObject({
      clientId: 'bad',
      syncStatus: 'failed',
      syncError: 'Server error',
      syncAttempts: 1,
      nextRetryAt: 14_000,
    });
    expect(outbox().lastSynced?.count).toBe(1);
    jest.restoreAllMocks();
  });

  it('does not announce a sync or refresh the list when everything failed', async () => {
    outbox().add(pending('bad'));
    repository.createFromOutbox.mockRejectedValue(new ApiError(500, 'Server error'));

    await runSync();

    expect(outbox().lastSynced).toBeNull();
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('leaves an item alone while its backoff runs, unless forced', async () => {
    outbox().add(pending('wait', { syncStatus: 'failed', syncAttempts: 2, nextRetryAt: Date.now() + 60_000 }));

    await runSync();
    expect(repository.createFromOutbox).not.toHaveBeenCalled();

    await runSync({ force: true });
    expect(repository.createFromOutbox).toHaveBeenCalledTimes(1);
    expect(outbox().items).toEqual([]);
  });

  describe('safety checks', () => {
    it('does nothing while offline, so pending items stay pending instead of turning into failures', async () => {
      outbox().add(pending('a'));
      useNetworkStore.setState({ isOnline: false });

      await runSync({ force: true });

      expect(repository.createFromOutbox).not.toHaveBeenCalled();
      expect(outbox().items[0].syncStatus).toBe('pending');
    });

    it('does nothing when nobody is signed in', async () => {
      outbox().add(pending('a'));
      useAuthStore.setState({ status: 'signedOut', user: null });

      await runSync();

      expect(repository.createFromOutbox).not.toHaveBeenCalled();
    });

    it('waits for the saved outbox to load before reading it', async () => {
      useOutboxStore.setState({ hasHydrated: false });
      outbox().add(pending('a'));

      const done = runSync();
      await Promise.resolve();
      await Promise.resolve();
      expect(repository.createFromOutbox).not.toHaveBeenCalled();

      useOutboxStore.setState({ hasHydrated: true });
      await done;

      expect(repository.createFromOutbox).toHaveBeenCalledTimes(1);
    });

    it('throws away the results if the user signed out while sending', async () => {
      outbox().add(pending('a'));
      const request = deferred<Checkin>();
      repository.createFromOutbox.mockReturnValue(request.promise);

      const done = runSync();
      await Promise.resolve();
      await Promise.resolve();
      useAuthStore.setState({ user: { id: 'u2', email: 'b@b.c', name: 'B' } });
      request.resolve(serverCopy(pending('a')));
      await done;

      expect(useCheckinsStore.getState().items).toEqual([]);
      expect(fetchAll).not.toHaveBeenCalled();
    });

    it('clears the "syncing" flag even if something unexpected throws', async () => {
      outbox().add(pending('a'));
      // createFromOutbox is wrapped by syncOutbox, so make the store itself blow up instead.
      jest.spyOn(Date, 'now').mockImplementation(() => {
        throw new Error('clock broke');
      });

      await expect(runSync()).rejects.toThrow('clock broke');

      expect(outbox().isSyncing).toBe(false);
      jest.restoreAllMocks();
    });

    it('shows isSyncing while sending', async () => {
      outbox().add(pending('a'));
      const request = deferred<Checkin>();
      repository.createFromOutbox.mockReturnValue(request.promise);

      const done = runSync();
      await Promise.resolve();
      await Promise.resolve();
      expect(outbox().isSyncing).toBe(true);

      request.resolve(serverCopy(pending('a')));
      await done;
      expect(outbox().isSyncing).toBe(false);
    });
  });

  describe('concurrency', () => {
    it('never runs twice at once: a second caller gets the run already going', async () => {
      outbox().add(pending('a'));
      const request = deferred<Checkin>();
      repository.createFromOutbox.mockReturnValue(request.promise);

      const first = runSync();
      const second = runSync();
      const third = runSync({ force: false });
      request.resolve(serverCopy(pending('a')));
      const summaries = await Promise.all([first, second, third]);

      expect(repository.createFromOutbox).toHaveBeenCalledTimes(1);
      expect(summaries).toEqual([
        { synced: 1, failed: 0 },
        { synced: 1, failed: 0 },
        { synced: 1, failed: 0 },
      ]);
    });

    it('allows a new run once the previous one has finished', async () => {
      outbox().add(pending('a'));
      await runSync();
      outbox().add(pending('b'));
      await runSync();

      expect(repository.createFromOutbox).toHaveBeenCalledTimes(2);
    });

    it('a forced Retry asked during a normal run is not dropped: it runs right after', async () => {
      // 'slow' is being sent; 'waiting' is in backoff, so the normal run skips it.
      outbox().add(pending('slow', { checkinDate: '2026-01-01' }));
      outbox().add(pending('waiting', { syncStatus: 'failed', syncAttempts: 1, nextRetryAt: Date.now() + 60_000, checkinDate: '2026-01-02' }));
      const slow = deferred<Checkin>();
      repository.createFromOutbox.mockImplementation((item) => (item.clientId === 'slow' ? slow.promise : Promise.resolve(serverCopy(item))));

      const normal = runSync();
      const retry = runSync({ force: true });
      slow.resolve(serverCopy(pending('slow')));
      await Promise.all([normal, retry]);

      expect(repository.createFromOutbox.mock.calls.map(([item]) => item.clientId)).toEqual(['slow', 'waiting']);
      expect(outbox().items).toEqual([]);
    });
  });

  describe('no flicker, no duplicate', () => {
    it('the merged list holds each check-in exactly once at every moment of the sync', async () => {
      const items = [pending('a', { checkinDate: '2026-01-01' }), pending('b', { checkinDate: '2026-01-02' })];
      items.forEach((item) => outbox().add(item));

      // Look at what a screen would see after every single store change.
      const snapshots: string[][] = [];
      const record = () =>
        snapshots.push(
          mergeWithOutbox(outbox().items, useCheckinsStore.getState().items)
            .map((c) => c.clientId)
            .sort(),
        );
      const stopOutbox = useOutboxStore.subscribe(record);
      const stopCheckins = useCheckinsStore.subscribe(record);

      await runSync();
      stopOutbox();
      stopCheckins();

      expect(snapshots.length).toBeGreaterThan(0);
      for (const snapshot of snapshots) expect(snapshot).toEqual(['a', 'b']);
      expect(mergeWithOutbox(outbox().items, useCheckinsStore.getState().items).map((c) => c.id).sort()).toEqual([
        'ck_a',
        'ck_b',
      ]);
    });

    it('inserts the server copies in one state change, and removes the outbox items in one', async () => {
      outbox().add(pending('a'));
      outbox().add(pending('b'));
      const onCheckins = jest.fn();
      const onOutbox = jest.fn();
      const stopCheckins = useCheckinsStore.subscribe(onCheckins);

      // Count only the changes made by the finish step, not the "syncing" flag toggles around it.
      const stopOutbox = useOutboxStore.subscribe((state, previous) => {
        if (state.items !== previous.items) onOutbox();
      });
      await runSync();
      stopCheckins();
      stopOutbox();

      expect(onCheckins).toHaveBeenCalledTimes(1);
      expect(onOutbox).toHaveBeenCalledTimes(1);
    });

    it('still shows one copy if a refresh from the server lands before the outbox item is removed', () => {
      const local = pending('a');
      const fromServer = serverCopy(local);

      expect(mergeWithOutbox([local], [fromServer])).toEqual([fromServer]);
    });
  });
});
