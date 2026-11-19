import { useCallback, useRef, useState } from 'react';

/**
 * Stops a double tap from running an action twice.
 *
 * The ref is the real lock: it flips synchronously, so the second tap of a fast double tap sees it
 * even though React has not re-rendered yet. `isSubmitting` is state only so the UI can show a spinner.
 * `run` returns undefined, without calling `fn`, when it is already running.
 */
export function useSubmitLock() {
  const locked = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setIsSubmitting(true);
    try {
      return await fn();
    } finally {
      locked.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { run, isSubmitting };
}
