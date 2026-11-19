/** The parts of a NetInfo state we look at. Kept separate so this file does not import the native module. */
export interface ConnectivitySnapshot {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

/**
 * `null` means "NetInfo does not know yet". Only a definite `false` counts as offline, so the app
 * is never stuck in offline mode just because the first reading was slow.
 * `isInternetReachable === false` covers Wi-Fi with no internet behind it.
 */
export function isOnlineFromSnapshot({ isConnected, isInternetReachable }: ConnectivitySnapshot): boolean {
  return isConnected !== false && isInternetReachable !== false;
}
