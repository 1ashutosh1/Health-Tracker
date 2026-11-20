import { useAuthStore } from '../stores/authStore';

/** The check-in id waiting to be opened after login, or null. The login screen uses it to explain itself. */
export function usePendingDeepLink(): string | null {
  return useAuthStore((s) => s.pendingDeepLink);
}
