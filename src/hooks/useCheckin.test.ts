import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError, NetworkError, NotFoundError } from '../utils/errors';
import { useCheckin } from './useCheckin';

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

const store = () => useCheckinsStore.getState();

beforeEach(() => {
  jest.resetAllMocks();
  store().reset();
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('useCheckin', () => {
  it('returns the cached item instantly with no spinner, then refreshes quietly', async () => {
    const cached = makeCheckin({ id: 'ck_1', weightKg: 70 });
    const fresh = { ...cached, weightKg: 69 };
    store().upsert(cached);
    const request = deferred<Checkin>();
    repository.getById.mockReturnValue(request.promise);

    const { result } = await renderHook(() => useCheckin('ck_1'));

    // Already on screen before the network answers.
    expect(result.current).toMatchObject({ data: cached, status: 'success', isRefreshing: true });

    await act(async () => request.resolve(fresh));

    expect(result.current).toMatchObject({ data: fresh, status: 'success', isRefreshing: false });
    expect(store().items).toEqual([fresh]); // the list sees the newer copy too
  });

  it('shows loading when there is nothing cached (deep link), then the item', async () => {
    const item = makeCheckin({ id: 'ck_9' });
    const request = deferred<Checkin>();
    repository.getById.mockReturnValue(request.promise);

    const { result } = await renderHook(() => useCheckin('ck_9'));
    expect(result.current).toMatchObject({ data: null, status: 'loading', isRefreshing: false });

    await act(async () => request.resolve(item));

    expect(result.current).toMatchObject({ data: item, status: 'success' });
  });

  it("reports 'notFound' for a NotFoundError and drops the stale cached copy", async () => {
    store().upsert(makeCheckin({ id: 'ck_gone' }));
    repository.getById.mockRejectedValue(new NotFoundError('Check-in not found'));

    const { result } = await renderHook(() => useCheckin('ck_gone'));
    await act(async () => {});

    expect(result.current.status).toBe('notFound');
    expect(store().items).toEqual([]);
  });

  it('shows an error when nothing is cached, and Retry loads it', async () => {
    const item = makeCheckin({ id: 'ck_2' });
    repository.getById.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(item);

    const { result } = await renderHook(() => useCheckin('ck_2'));
    await act(async () => {});
    expect(result.current).toMatchObject({ data: null, status: 'error' });
    expect(result.current.error).toMatch(/connection/i);

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current).toMatchObject({ data: item, status: 'success', error: null });
  });

  it('keeps showing the cached item when the background refresh fails', async () => {
    const cached = makeCheckin({ id: 'ck_3' });
    store().upsert(cached);
    repository.getById.mockRejectedValue(new ApiError(500, 'Server error'));

    const { result } = await renderHook(() => useCheckin('ck_3'));
    await act(async () => {});

    expect(result.current).toMatchObject({ data: cached, status: 'error', error: 'Server error' });
  });

  it('ignores a result that arrives after unmount', async () => {
    const request = deferred<Checkin>();
    repository.getById.mockReturnValue(request.promise);
    const { unmount } = await renderHook(() => useCheckin('ck_4'));

    await unmount();
    await act(async () => request.resolve(makeCheckin({ id: 'ck_4' })));

    expect(store().items).toEqual([]);
  });

  it('ignores a result that arrives after logout', async () => {
    const request = deferred<Checkin>();
    repository.getById.mockReturnValue(request.promise);
    await renderHook(() => useCheckin('ck_5'));

    useAuthStore.setState({ status: 'signedOut', user: null });
    await act(async () => request.resolve(makeCheckin({ id: 'ck_5' })));

    expect(store().items).toEqual([]);
  });

  it('keeps showing the last copy when the item is removed from the store (optimistic delete)', async () => {
    const cached = makeCheckin({ id: 'ck_6' });
    store().upsert(cached);
    repository.getById.mockResolvedValue(cached);
    const { result } = await renderHook(() => useCheckin('ck_6'));
    await act(async () => {});

    await act(async () => store().removeLocal('ck_6'));

    expect(result.current.data).toEqual(cached);
    expect(result.current.status).toBe('success');
  });
});
