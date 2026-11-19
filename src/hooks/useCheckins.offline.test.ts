import NetInfo from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError, NetworkError } from '../utils/errors';
import { useCheckins } from './useCheckins';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const pendingItem = (clientId: string, overrides: Partial<Checkin> = {}) =>
  makeCheckin({ id: `local_${clientId}`, clientId, syncStatus: 'pending', ...overrides });

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  useCheckinsStore.setState({ hasHydrated: true });
  useOutboxStore.getState().reset();
  useNetworkStore.setState({ isOnline: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('saved copy and hydration', () => {
  it('reports loading, and does not fetch, until the saved copy has been read', async () => {
    useCheckinsStore.setState({ hasHydrated: false });
    repository.getAll.mockResolvedValue([]);

    const { result } = await renderHook(() => useCheckins());

    // Not "empty": a screen must not say "No check-ins yet" before it knows what is on disk.
    expect(result.current).toMatchObject({ status: 'loading', data: [], isRefreshing: false });
    expect(repository.getAll).not.toHaveBeenCalled();

    await act(async () => useCheckinsStore.setState({ hasHydrated: true }));

    expect(repository.getAll).toHaveBeenCalledTimes(1);
  });

  it('shows the saved check-ins at once after a restart and refreshes them quietly', async () => {
    const saved = [makeCheckin({ id: 'ck_1' })];
    useCheckinsStore.setState({ items: saved, ownerUserId: 'u1', lastFetchedAt: Date.now() - 60_000 });
    const request = deferred<Checkin[]>();
    repository.getAll.mockReturnValue(request.promise);

    const { result } = await renderHook(() => useCheckins());

    expect(result.current).toMatchObject({ data: saved, status: 'loading', isRefreshing: true });
    await act(async () => request.resolve([...saved, makeCheckin()]));
    expect(result.current.data).toHaveLength(2);
  });

  it("never shows another user's saved check-ins, and does not trust their timestamp", async () => {
    useCheckinsStore.setState({ items: [makeCheckin()], ownerUserId: 'someone-else', lastFetchedAt: Date.now() });
    repository.getAll.mockResolvedValue([]);

    const { result } = await renderHook(() => useCheckins());

    expect(result.current.data).toEqual([]);
    expect(repository.getAll).toHaveBeenCalledTimes(1);
  });
});

describe('offline', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOnline: false });
  });

  it('does not fetch, and returns the saved data with the offline flag', async () => {
    const saved = [makeCheckin({ id: 'ck_1' })];
    useCheckinsStore.setState({ items: saved, ownerUserId: 'u1', lastFetchedAt: Date.now() - 600_000 });

    const { result } = await renderHook(() => useCheckins());

    expect(repository.getAll).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: saved, status: 'success', error: null, isOffline: true });
  });

  it('treats "fetched before and it was empty" as a real, empty answer, not an error', async () => {
    useCheckinsStore.setState({ items: [], ownerUserId: 'u1', lastFetchedAt: Date.now() });

    const { result } = await renderHook(() => useCheckins());

    expect(result.current).toMatchObject({ data: [], status: 'success', error: null });
  });

  it('with nothing saved at all it is an error (Retry), because there is nothing to show', async () => {
    const { result } = await renderHook(() => useCheckins());

    expect(result.current).toMatchObject({ status: 'error', error: new NetworkError().message, data: [] });
  });

  it('with only pending check-ins, shows them instead of an error', async () => {
    const mine = pendingItem('a');
    useOutboxStore.getState().add(mine);

    const { result } = await renderHook(() => useCheckins());

    expect(result.current).toMatchObject({ status: 'success', data: [mine] });
  });

  it('fetches by itself once the connection is back', async () => {
    repository.getAll.mockResolvedValue([makeCheckin()]);
    const { result } = await renderHook(() => useCheckins());
    expect(repository.getAll).not.toHaveBeenCalled();

    await act(async () => useNetworkStore.setState({ isOnline: true }));

    expect(repository.getAll).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ status: 'success', isOffline: false });
    expect(result.current.data).toHaveLength(1);
  });

  it('refetch() asks NetInfo again before giving up (the store may be out of date)', async () => {
    repository.getAll.mockResolvedValue([]);
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true, isInternetReachable: true } as never);
    const { result } = await renderHook(() => useCheckins());

    // NetInfo says "connected", so looking again finds we are online after all.
    await act(async () => {
      await result.current.refetch();
    });

    expect(useNetworkStore.getState().isOnline).toBe(true);
    expect(repository.getAll).toHaveBeenCalled();
  });
});

describe('a request that fails because there is no connection', () => {
  it('with data on screen: keeps it as success, flagged offline, instead of an error screen', async () => {
    const saved = [makeCheckin({ id: 'ck_1' })];
    useCheckinsStore.setState({ items: saved, ownerUserId: 'u1', lastFetchedAt: Date.now() - 600_000 });
    repository.getAll.mockRejectedValue(new NetworkError());

    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    expect(useCheckinsStore.getState()).toMatchObject({ status: 'error', errorIsNetwork: true });
    expect(result.current).toMatchObject({ data: saved, status: 'success', error: null, isOffline: true });
  });

  it('with nothing to show: stays an error, so the screen can offer Retry', async () => {
    repository.getAll.mockRejectedValue(new NetworkError());

    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    expect(result.current).toMatchObject({ status: 'error', error: new NetworkError().message, isOffline: true });
  });

  it('a server error with data on screen is still an error (not offline)', async () => {
    useCheckinsStore.setState({ items: [makeCheckin()], ownerUserId: 'u1', lastFetchedAt: Date.now() - 600_000 });
    repository.getAll.mockRejectedValue(new ApiError(500, 'Server error'));

    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    expect(result.current).toMatchObject({ status: 'error', error: 'Server error', isOffline: false });
  });
});

describe('merged with the outbox', () => {
  it('lists pending check-ins first, then the server ones', async () => {
    const server = [makeCheckin({ id: 'ck_1' })];
    const mine = pendingItem('a');
    repository.getAll.mockResolvedValue(server);
    useOutboxStore.getState().add(mine);

    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    expect(result.current.data).toEqual([mine, ...server]);
  });

  it('shows a check-in once when the server list already has its clientId', async () => {
    const mine = pendingItem('a');
    const fromServer = makeCheckin({ id: 'ck_9', clientId: 'a' });
    repository.getAll.mockResolvedValue([fromServer]);
    useOutboxStore.getState().add(mine);

    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    expect(result.current.data).toEqual([fromServer]);
  });

  it('updates when something is added to the outbox', async () => {
    repository.getAll.mockResolvedValue([]);
    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    await act(async () => useOutboxStore.getState().add(pendingItem('late')));

    expect(result.current.data.map((c) => c.clientId)).toEqual(['late']);
  });
});
