import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { NetworkError } from '../utils/errors';
import { useCheckin } from './useCheckin';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const store = () => useCheckinsStore.getState();
const outbox = () => useOutboxStore.getState();

beforeEach(() => {
  jest.resetAllMocks();
  store().reset();
  outbox().reset();
  useNetworkStore.setState({ isOnline: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('offline', () => {
  it('returns the saved copy with no request, no error and no spinner', async () => {
    const cached = makeCheckin({ id: 'ck_1' });
    store().upsert(cached);
    useNetworkStore.setState({ isOnline: false });

    const { result } = await renderHook(() => useCheckin('ck_1'));
    await act(async () => {});

    expect(repository.getById).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      data: cached,
      status: 'success',
      error: null,
      isRefreshing: false,
      isOffline: true,
    });
  });

  it('with no saved copy: an error the screen can offer Retry for', async () => {
    useNetworkStore.setState({ isOnline: false });

    const { result } = await renderHook(() => useCheckin('ck_1'));
    await act(async () => {});

    expect(result.current).toMatchObject({ data: null, status: 'error', error: new NetworkError().message });
  });

  it('a request that fails for lack of connection keeps the saved copy on screen', async () => {
    const cached = makeCheckin({ id: 'ck_1' });
    store().upsert(cached);
    repository.getById.mockRejectedValue(new NetworkError());

    const { result } = await renderHook(() => useCheckin('ck_1'));
    await act(async () => {});

    expect(result.current).toMatchObject({ data: cached, status: 'success', error: null });
  });

  it('refreshes by itself when the connection comes back', async () => {
    const cached = makeCheckin({ id: 'ck_1', weightKg: 70 });
    store().upsert(cached);
    useNetworkStore.setState({ isOnline: false });
    repository.getById.mockResolvedValue({ ...cached, weightKg: 69 });
    const { result } = await renderHook(() => useCheckin('ck_1'));
    await act(async () => {});
    expect(repository.getById).not.toHaveBeenCalled();

    await act(async () => useNetworkStore.setState({ isOnline: true }));

    expect(result.current.data?.weightKg).toBe(69);
  });
});

describe('check-ins that only exist on this device', () => {
  const mine = makeCheckin({ id: 'local_a', clientId: 'a', syncStatus: 'pending', weightKg: 70 });

  it('finds a pending check-in in the outbox and never asks the server for it', async () => {
    outbox().add(mine);

    const { result } = await renderHook(() => useCheckin('local_a'));
    await act(async () => {});

    expect(repository.getById).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: mine, status: 'success', isRefreshing: false });
  });

  it('a "local_" id nobody has is simply not found', async () => {
    const { result } = await renderHook(() => useCheckin('local_nope'));
    await act(async () => {});

    expect(result.current).toMatchObject({ data: null, status: 'notFound' });
  });

  it('follows a pending check-in to its server copy when the sync finishes, instead of showing "not found"', async () => {
    const synced = { ...mine, id: 'ck_77', syncStatus: 'synced' as const };
    outbox().add(mine);
    const { result } = await renderHook(() => useCheckin('local_a'));
    await act(async () => {});

    // What runSync does: the server copy appears and the outbox item goes.
    await act(async () => {
      store().upsertMany([synced]);
      outbox().markSynced(['a']);
    });

    expect(result.current).toMatchObject({ data: synced, status: 'success' });
  });

  it('shows an edit made to the pending item', async () => {
    outbox().add(mine);
    const { result } = await renderHook(() => useCheckin('local_a'));

    await act(async () => {
      outbox().update('a', { weightKg: 68 });
    });

    expect(result.current.data?.weightKg).toBe(68);
  });
});
