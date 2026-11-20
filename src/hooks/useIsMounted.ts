import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a function that says whether the component is still on screen.
 * Call it after an `await` before setting local state: the user may have navigated away meanwhile.
 * (Writes to a Zustand store do not need it; stores outlive screens.)
 */
export function useIsMounted(): () => boolean {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(() => mounted.current, []);
}
