import { useCallback, useRef, useState } from 'react';

import { useAuthStore } from '../stores/authStore';
import type { LoginCredentials } from '../types/auth';
import { getErrorMessage } from '../utils/errors';

/**
 * Submit handler for the login form.
 * The ref is a lock that flips synchronously, so a fast double tap sends one request.
 * `isSubmitting` is state only for the UI, because state updates arrive too late to guard.
 */
export function useLogin() {
  const signIn = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      if (lock.current) return;
      lock.current = true;
      setIsSubmitting(true);
      setError(null);
      try {
        await signIn(credentials);
        // On success the auth guard replaces this screen, so there is nothing more to do here.
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        lock.current = false;
        setIsSubmitting(false);
      }
    },
    [signIn],
  );

  const reset = useCallback(() => setError(null), []);

  return { login, isSubmitting, error, reset };
}
