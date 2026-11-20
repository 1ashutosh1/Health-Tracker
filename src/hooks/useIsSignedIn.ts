import { useAuthStore } from '../stores/authStore';

export function useIsSignedIn(): boolean {
  return useAuthStore((s) => s.status === 'signedIn');
}
