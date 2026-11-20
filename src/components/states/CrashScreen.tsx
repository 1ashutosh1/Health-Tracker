import { useEffect } from 'react';

import { logger } from '../../utils/logger';
import { Screen } from '../ui/Screen';
import { ErrorState } from './ErrorState';

interface CrashScreenProps {
  error: Error;
  /** Tries to render the app again from the top. */
  onRestart: () => void;
}

/**
 * The last-resort screen, shown when something throws while rendering. It must not depend on any
 * store or hook that could be the thing that broke, so it only uses plain UI components.
 * The error's own message is shown in development only; users get a fixed, safe sentence.
 */
export function CrashScreen({ error, onRestart }: CrashScreenProps) {
  useEffect(() => {
    logger.error('[crash] the app failed to render', error);
  }, [error]);

  const message = __DEV__
    ? `The app ran into an unexpected problem.\n\n${error.message}`
    : 'The app ran into an unexpected problem. Restart to try again.';

  return (
    <Screen>
      <ErrorState title="Something went wrong" message={message} actionLabel="Restart" onRetry={onRestart} />
    </Screen>
  );
}
