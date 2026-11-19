import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError } from '../utils/errors';
import { useCheckins } from './useCheckins';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  // Reading the saved copy from disk is async; these tests are about what happens after it.
  useCheckinsStore.setState({ hasHydrated: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('useCheckins', () => {
  it('loads on mount: loading with no data, then success', async () => {
    const items = [makeCheckin(), makeCheckin()];
    const request = deferred<Checkin[]>();
    repository.getAll.mockReturnValue(request.promise);

    const { result } = await renderHook(() => useCheckins());
    expect(result.current.status).toBe('loading');
    expect(result.current.isRefreshing).toBe(false); // first load, not a refresh
    expect(result.current.data).toEqual([]);

    await act(async () => request.resolve(items));

    expect(result.current).toMatchObject({ status: 'success', data: items, error: null, isRefreshing: false });
  });

  it('does not refetch on mount when the data is fresh', async () => {
    repository.getAll.mockResolvedValue([makeCheckin()]);
    await act(async () => useCheckinsStore.getState().fetchAll('u1'));
    expect(repository.getAll).toHaveBeenCalledTimes(1);

    await renderHook(() => useCheckins());

    expect(repository.getAll).toHaveBeenCalledTimes(1);
  });

  it('refetches on mount when the data is more than 30 seconds old', async () => {
    repository.getAll.mockResolvedValue([makeCheckin()]);
    await act(async () => useCheckinsStore.getState().fetchAll('u1'));
    useCheckinsStore.setState({ lastFetchedAt: Date.now() - 31_000 });

    await renderHook(() => useCheckins());

    expect(repository.getAll).toHaveBeenCalledTimes(2);
  });

  it('refetch() keeps the old data on screen and reports isRefreshing', async () => {
    const items = [makeCheckin()];
    repository.getAll.mockResolvedValueOnce(items);
    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    const second = deferred<Checkin[]>();
    repository.getAll.mockReturnValueOnce(second.promise);
    let done!: Promise<void>;
    await act(async () => {
      done = result.current.refetch();
    });

    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.data).toEqual(items); // no blank screen while refreshing

    await act(async () => {
      second.resolve([...items, makeCheckin()]);
      await done;
    });
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.data).toHaveLength(2);
  });

  it('reports an error and Retry (refetch) recovers from it', async () => {
    repository.getAll.mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValue([makeCheckin()]);
    const { result } = await renderHook(() => useCheckins());
    await act(async () => {});

    expect(result.current).toMatchObject({ status: 'error', error: 'Server error', data: [] });

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current).toMatchObject({ status: 'success', error: null });
    expect(result.current.data).toHaveLength(1);
  });

  it('two screens mounting together share one request', async () => {
    repository.getAll.mockResolvedValue([]);

    await renderHook(() => useCheckins());
    await renderHook(() => useCheckins());

    expect(repository.getAll).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when nobody is signed in', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null });

    await renderHook(() => useCheckins());

    expect(repository.getAll).not.toHaveBeenCalled();
  });
});
