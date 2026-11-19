import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { runSync } from '../services/syncService';
import { useAuthStore } from '../stores/authStore';
import { useNetworkStore } from '../stores/networkStore';
import { useNetworkSync } from './useNetworkSync';

jest.mock('../services/syncService');
const sync = jest.mocked(runSync);

let appStateListener: ((state: AppStateStatus) => void) | undefined;
const remove = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  sync.mockResolvedValue({ synced: 0, failed: 0 });
  appStateListener = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove } as never;
  });
  useNetworkStore.setState({ isOnline: true, lastChangedAt: null });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('useNetworkSync', () => {
  it('syncs (forced) when it mounts with a signed-in user: login and app start', async () => {
    await renderHook(() => useNetworkSync());

    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith({ force: true });
  });

  it('syncs when a user logs in after the app was already running', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null });
    await renderHook(() => useNetworkSync());
    expect(sync).not.toHaveBeenCalled();

    await act(async () => useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } }));

    expect(sync).toHaveBeenCalledWith({ force: true });
  });

  it('does nothing while signed out', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null });
    await renderHook(() => useNetworkSync());

    await act(async () => useNetworkStore.setState({ isOnline: false }));
    await act(async () => useNetworkStore.setState({ isOnline: true }));
    await act(async () => appStateListener?.('active'));

    expect(sync).not.toHaveBeenCalled();
  });

  it('syncs (forced) when the connection comes back', async () => {
    useNetworkStore.setState({ isOnline: false });
    await renderHook(() => useNetworkSync());
    sync.mockClear();

    await act(async () => useNetworkStore.setState({ isOnline: true }));

    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith({ force: true });
  });

  it('does not sync when the connection goes away', async () => {
    await renderHook(() => useNetworkSync());
    sync.mockClear();

    await act(async () => useNetworkStore.setState({ isOnline: false }));

    expect(sync).not.toHaveBeenCalled();
  });

  it('syncs (not forced, so backoff is respected) when the app returns to the foreground', async () => {
    await renderHook(() => useNetworkSync());
    sync.mockClear();

    await act(async () => appStateListener?.('background'));
    expect(sync).not.toHaveBeenCalled();

    await act(async () => appStateListener?.('active'));
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith();
  });

  it('stops listening to the app state when unmounted', async () => {
    const { unmount } = await renderHook(() => useNetworkSync());

    await unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
