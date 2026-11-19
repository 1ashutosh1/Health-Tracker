import { useEffect } from 'react';

import { startNetworkMonitor } from '../services/networkMonitor';

/** Keeps networkStore in step with NetInfo. Mounted once, in the root layout. */
export function useNetworkMonitor(): void {
  useEffect(() => startNetworkMonitor(), []);
}
