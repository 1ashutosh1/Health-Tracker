import { useCallback } from 'react';

import { runSync } from '../services/syncService';

/** The "Retry" on a failed check-in: sends everything now, ignoring the backoff. */
export function useRetrySync(): () => void {
  return useCallback(() => void runSync({ force: true }), []);
}
