import NetInfo from '@react-native-community/netinfo';

import { devConfig } from '../api/mockServer';
import { useNetworkStore } from '../stores/networkStore';
import { refreshNetworkStatus, startNetworkMonitor } from './networkMonitor';

const netInfo = jest.mocked(NetInfo);

const wifi = { isConnected: true, isInternetReachable: true };
type Listener = (state: unknown) => void;

/** Starts the monitor and hands back the function NetInfo would call on every change. */
function start() {
  const unsubscribe = jest.fn();
  netInfo.addEventListener.mockReturnValue(unsubscribe);
  const stop = startNetworkMonitor();
  const emit = netInfo.addEventListener.mock.calls[0][0] as Listener;
  return { emit, stop, unsubscribe };
}

beforeEach(() => {
  jest.resetAllMocks();
  devConfig.forceOffline = false;
  useNetworkStore.setState({ isOnline: true, lastChangedAt: null });
});

afterEach(() => {
  devConfig.forceOffline = false;
});

describe('startNetworkMonitor', () => {
  it('feeds every NetInfo change into networkStore', () => {
    const { emit } = start();

    emit({ isConnected: false, isInternetReachable: false });
    expect(useNetworkStore.getState().isOnline).toBe(false);

    emit(wifi);
    expect(useNetworkStore.getState().isOnline).toBe(true);
  });

  it('treats isInternetReachable === false as offline even when connected', () => {
    const { emit } = start();

    emit({ isConnected: true, isInternetReachable: false });

    expect(useNetworkStore.getState().isOnline).toBe(false);
  });

  it('stays offline while devConfig.forceOffline is on, whatever NetInfo says', () => {
    const { emit } = start();
    devConfig.forceOffline = true;

    emit(wifi);

    expect(useNetworkStore.getState().isOnline).toBe(false);
  });

  it('returns the unsubscribe function', () => {
    const { stop, unsubscribe } = start();

    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('refreshNetworkStatus', () => {
  it('reads NetInfo now and updates the store', async () => {
    netInfo.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false } as never);

    await refreshNetworkStatus();

    expect(useNetworkStore.getState().isOnline).toBe(false);
  });

  it('picks up a change to forceOffline, which raises no NetInfo event', async () => {
    netInfo.fetch.mockResolvedValue(wifi as never);
    devConfig.forceOffline = true;

    await refreshNetworkStatus();

    expect(useNetworkStore.getState().isOnline).toBe(false);
  });
});
