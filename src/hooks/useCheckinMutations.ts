import { useCallback, useState } from 'react';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import type { CheckinFields } from '../types/checkin';
import { getErrorMessage, NotFoundError } from '../utils/errors';
import { useIsMounted } from './useIsMounted';
import { useSubmitLock } from './useSubmitLock';

export interface UseMutationResult<Args extends unknown[]> {
  /** Resolves true if it worked, false if it failed (the message is then in `error`) or was ignored as a duplicate. */
  mutate: (...args: Args) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  /** Clears `error`, for example when the user starts editing again. */
  reset: () => void;
}

const currentUserId = () => useAuthStore.getState().user?.id ?? null;

/**
 * What the three hooks below share: the duplicate-tap lock, the `isSubmitting` flag and the error message.
 * `action` throws on failure; this turns that into `false` plus `error`.
 */
function useMutation<Args extends unknown[]>(action: (...args: Args) => Promise<void>): UseMutationResult<Args> {
  const { run, isSubmitting } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();

  const mutate = useCallback(
    async (...args: Args) => {
      const succeeded = await run(async () => {
        setError(null);
        try {
          await action(...args);
          return true;
        } catch (e) {
          // The user may have left the screen while this was running: no one is left to show the message to.
          if (isMounted()) setError(getErrorMessage(e));
          return false;
        }
      });
      return succeeded ?? false;
    },
    [run, action, isMounted],
  );

  const reset = useCallback(() => setError(null), []);

  return { mutate, isSubmitting, error, reset };
}

/**
 * Saves a new check-in. A saved one goes into checkinsStore so the list shows it instantly.
 * A pending one (made offline) is already in the outbox, which the list reads too; adding it here as well would show it twice.
 */
export function useCreateCheckin(): UseMutationResult<[fields: CheckinFields]> {
  const upsert = useCheckinsStore((s) => s.upsert);

  const create = useCallback(
    async (fields: CheckinFields) => {
      const userId = currentUserId();
      const saved = await checkinRepository.create(fields);
      // Signed out while saving: the account's data must not land in the next user's store.
      if (saved.syncStatus === 'synced' && currentUserId() === userId) upsert(saved);
    },
    [upsert],
  );

  return useMutation(create);
}

/** Saves changes to one check-in, then replaces it in the store (a pending one is edited in the outbox instead). */
export function useUpdateCheckin(id: string): UseMutationResult<[fields: CheckinFields]> {
  const upsert = useCheckinsStore((s) => s.upsert);

  const update = useCallback(
    async (fields: CheckinFields) => {
      const userId = currentUserId();
      // `notes` is listed explicitly: clearing the notes box must send "no notes", not leave the old text.
      const saved = await checkinRepository.update(id, { ...fields, notes: fields.notes });
      if (saved.syncStatus === 'synced' && currentUserId() === userId) upsert(saved);
    },
    [id, upsert],
  );

  return useMutation(update);
}

/**
 * Optimistic delete: the check-in disappears from the list at once, and comes back
 * if the server refuses, with the reason in `error`.
 */
export function useDeleteCheckin(id: string): UseMutationResult<[]> {
  const upsert = useCheckinsStore((s) => s.upsert);
  const removeLocal = useCheckinsStore((s) => s.removeLocal);

  const remove = useCallback(async () => {
    // Check first: offline, a synced check-in must stay on screen instead of vanishing and coming back.
    checkinRepository.assertEditable(id);
    const userId = currentUserId();
    const previous = useCheckinsStore.getState().items.find((c) => c.id === id);
    removeLocal(id);
    try {
      await checkinRepository.remove(id);
    } catch (e) {
      // Already gone on the server: the user's goal is met, nothing to restore.
      if (e instanceof NotFoundError) return;
      if (previous && currentUserId() === userId) upsert(previous);
      throw e;
    }
  }, [id, upsert, removeLocal]);

  return useMutation(remove);
}
