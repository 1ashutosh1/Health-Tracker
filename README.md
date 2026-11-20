# Health Progress Tracker

> **Draft.** Only the deep-linking section is written so far. The full README (setup, architecture, offline sync, decisions, AI usage) is written in the final phase.

## Deep linking

The app registers the scheme `healthtracker` (`app.json`). The link `healthtracker://checkin/<id>` opens that check-in's detail screen.

| Situation | What happens |
|---|---|
| Signed in, app running (warm) | Opens the detail. Back goes to the Check-ins/Summary tabs. |
| Signed in, app closed (cold) | Starts straight on the detail, with the tabs underneath so Back stays in the app. |
| Signed out (warm or cold) | Shows Login with "Sign in to open the shared check-in". After login the detail opens, with the tabs underneath. |
| Check-in does not exist | "Check-in not found" with a "Go to Check-ins" button. |
| Check-in only exists on this phone (`local_...` id, not synced yet) | Opens from the outbox, with a "Pending sync" badge. |
| Any other path (`healthtracker://banana`) | "Page not found" with a button back home. |

How it works: Expo Router maps the URL to `src/app/checkin/[id]/index.tsx` itself. `useDeepLinkHandler` (mounted in the root layout) only covers the signed-out case. It remembers the id in `authStore.pendingDeepLink`, and opens it once after login. `src/domain/deepLink.ts` parses and validates the URL.

### Testing with adb

```sh
# Use your applicationId from app.json (android.package)
PKG=com.ashutosh.healthtracker

# Warm start (app open): use a real id from the Check-ins list
adb shell am start -W -a android.intent.action.VIEW -d "healthtracker://checkin/ck_seed_3" $PKG

# Cold start: kill the app first, then open the link
adb shell am force-stop $PKG
adb shell am start -W -a android.intent.action.VIEW -d "healthtracker://checkin/ck_seed_3" $PKG

# Signed out: sign out in the app, force-stop, run the link, then sign in. The detail should open.

# A check-in that does not exist -> "Check-in not found"
adb shell am start -W -a android.intent.action.VIEW -d "healthtracker://checkin/doesnotexist" $PKG

# An unknown path -> "Page not found"
adb shell am start -W -a android.intent.action.VIEW -d "healthtracker://banana" $PKG

# Variants that are accepted: trailing slash and query string
adb shell am start -W -a android.intent.action.VIEW -d "healthtracker://checkin/ck_seed_3/?source=email" $PKG
```

Notes:
- Quote the URL, because `&` and `?` mean something to the shell.
- On the dev client, the launcher can swallow a cold-start URL. Check cold start again on a release build: `npx expo run:android --variant release`.
- The seeded demo account has ids `ck_seed_1`, `ck_seed_2`, and so on. A check-in you create gets a new `ck_...` id from the server once it has synced.
