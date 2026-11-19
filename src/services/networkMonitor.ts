import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { isForcedOffline } from '../api/checkinsApi';
import { isOnlineFromSnapshot } from '../domain/network';
import { useNetworkStore } from '../stores/networkStore';

function publish(state: NetInfoState): void {
  const online = isOnlineFromSnapshot(state) && !isForcedOffline();
  useNetworkStore.getState().setOnline(online);
}

/**
 * Feeds networkStore from NetInfo. Call once at app start; NetInfo reports the current state straight
 * away and again on every change. Returns the function that stops listening.
 */
export function startNetworkMonitor(): () => void {
  return NetInfo.addEventListener(publish);
}

/**
 * Reads the connection again right now. Used for a manual Retry while we think we are offline,
 * and after `devConfig.forceOffline` is changed (that flag does not raise a NetInfo event).
 */
export async function refreshNetworkStatus(): Promise<void> {
  publish(await NetInfo.fetch());
}
