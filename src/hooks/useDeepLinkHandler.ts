import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { parseDeepLink } from '../domain/deepLink';
import { useAuthStore } from '../stores/authStore';
import { checkinDetailHref } from '../utils/routes';

/**
 * Auth gating for healthtracker://checkin/:id. Mount it once, in the root layout.
 *
 * Expo Router already opens the link on cold and warm start when the user is signed in.
 * What it cannot do is open a screen that is guarded while signed out, so:
 *   signed out -> remember the check-in id (the guard shows Login), then open it right after login.
 *   signed in  -> nothing to do here.
 */
export function useDeepLinkHandler() {
  const router = useRouter();
  // The initial URL on cold start, then each new URL while the app is running.
  const url = Linking.useURL();
  const status = useAuthStore((s) => s.status);
  const pendingId = useAuthStore((s) => s.pendingDeepLink);
  const setPendingDeepLink = useAuthStore((s) => s.setPendingDeepLink);

  // The last URL we looked at. `url` keeps its value for the whole session, so without this a
  // link that was already handled would be picked up again at the next logout.
  const handledUrl = useRef<string | null>(null);

  // Look at each URL once the session is known. While 'hydrating' we do not know yet whether to
  // remember it or leave it to Expo Router (signed-in cold start), so we wait.
  useEffect(() => {
    if (!url || status === 'hydrating' || url === handledUrl.current) return;
    handledUrl.current = url;
    if (status !== 'signedOut') return;

    const link = parseDeepLink(url);
    if (link) setPendingDeepLink(link.id);
  }, [url, status, setPendingDeepLink]);

  // Once signed in, open the remembered check-in exactly once.
  useEffect(() => {
    if (status !== 'signedIn' || pendingId === null) return;

    // Login has just unlocked the signed-in screens. Wait one tick so the navigator has them before we
    // push, otherwise the push is dropped. The cleanup cancels a timer that has not fired yet (a logout,
    // or React strict mode running this effect twice), and the pending id is cleared in the same step as
    // the push, so there is only ever one push per link.
    const timer = setTimeout(() => {
      setPendingDeepLink(null);
      // push (not replace) so the tabs stay underneath and Back from the detail goes to them.
      router.push(checkinDetailHref(pendingId));
    }, 0);
    return () => clearTimeout(timer);
  }, [status, pendingId, setPendingDeepLink, router]);
}
