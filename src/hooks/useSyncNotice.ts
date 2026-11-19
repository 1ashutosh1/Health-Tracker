import { useEffect } from 'react';

import { formatSyncedMessage } from '../domain/sync';
import { useOutboxStore } from '../stores/outboxStore';

const NOTICE_MS = 4000;

/** "Synced 2 check-ins" for a few seconds after a sync, then null. */
export function useSyncNotice(): string | null {
  const lastSynced = useOutboxStore((s) => s.lastSynced);
  const dismiss = useOutboxStore((s) => s.dismissLastSynced);

  useEffect(() => {
    if (!lastSynced) return;
    const timer = setTimeout(dismiss, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [lastSynced, dismiss]);

  return lastSynced ? formatSyncedMessage(lastSynced.count) : null;
}
