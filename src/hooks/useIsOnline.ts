import { useNetworkStore } from '../stores/networkStore';

/** True while the phone has a connection (and the dev "force offline" switch is off). */
export function useIsOnline(): boolean {
  return useNetworkStore((s) => s.isOnline);
}
