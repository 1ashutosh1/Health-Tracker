import { useRouter } from 'expo-router';

import { EmptyState } from '../components/states/EmptyState';
import { Screen } from '../components/ui/Screen';
import { useIsSignedIn } from '../hooks/useIsSignedIn';

/**
 * Shown for any URL that matches no route (healthtracker://banana). "Home" depends on the session:
 * the tabs are guarded while signed out, so a signed-out user is sent to Sign in instead.
 */
export function NotFoundScreen() {
  const router = useRouter();
  const isSignedIn = useIsSignedIn();

  return (
    <Screen>
      <EmptyState
        icon="compass-outline"
        title="Page not found"
        message="This link does not match anything in Health Tracker."
        actionLabel={isSignedIn ? 'Go to Summary' : 'Go to Sign in'}
        onAction={() => router.replace(isSignedIn ? '/(tabs)' : '/login')}
      />
    </Screen>
  );
}
