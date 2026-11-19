import type { Href } from 'expo-router';

/**
 * The detail screen lives in src/app/checkin/[id]/index.tsx, so its URL is "/checkin/<id>".
 * Do not use the pathname "/checkin/[id]/index" with params: Expo Router would keep "index" as a
 * literal segment and navigate to "/checkin/<id>/index", which matches no route.
 * The typed-routes list contains that wrong pathname, so a plain string needs this cast.
 */
export function checkinDetailHref(id: string): Href {
  return `/checkin/${encodeURIComponent(id)}` as Href;
}
