# Health Progress Tracker: Build Plan (about 6 hours)

**How to use this file:** put `PLAN.md` and `CLAUDE.md` in the repo root. For each phase, paste the **Prompt** into Claude Code, let it finish, then go through the **Checkpoint** yourself on your phone. Don't start the next phase until every box is ticked, then commit using the given message.

> The brief estimates 6–8 hours and you have 5–6. The time boxes below add up to about 5h 40m of core work. **Phase 9 (bonus) is the first thing to cut.** Never trade a core requirement for a bonus.

---

## Key decisions (memorize these for the interview)

| Decision | Why |
|---|---|
| **Expo dev build, real Android phone over USB** | Faster than an emulator, and airplane mode gives you real offline testing. The phone's own screen recorder covers the demo video. The custom `healthtracker://` scheme needs a dev build, because Expo Go only handles `exp://`. |
| **All native deps installed in Phase 0, one dev build** | Each new native package forces a rebuild. Installing everything upfront means one 5–10 min build at the start, and it finds toolchain problems early instead of at hour 5. |
| **Local mock API (`mockServer.ts`) instead of json-server** | The APK works for reviewers with no server running. It has adjustable latency (600–1500 ms) and failure rate, and it checks NetInfo, so airplane mode really "breaks" it. It keeps its own AsyncStorage key, separate from the client cache, to act like a remote DB. |
| **Custom data hooks, no React Query** | Every bit of loading, error, retry, caching and dedupe logic is written by you and visible in the code. Nothing is hidden in a library, so you can explain all of it. The cost is that you write the retry and in-flight dedupe yourself (about 40 lines, tested). |
| **Zustand for all app state, with persist middleware** | One small, consistent tool. `checkinsStore` is the server cache, and persisting it to AsyncStorage *is* the offline-read feature. Selectors keep re-renders low, and the stores are testable outside React (`useStore.getState()`). |
| **Server cache and outbox in separate stores** | Server data and local-only pending data have different lifecycles. The hook merges them with `useMemo`. This matches the brief's "keep server data, locally persisted data, and UI state organized". |
| **Explicit outbox + pure sync engine** | "Pending / Synced / Failed" is real data you can show in the UI and unit test. |
| **`clientId` idempotency key** | If a sync request reaches the server but the response is lost, the retry doesn't create a duplicate, because the server dedupes on `clientId`. This is the strongest "data consistency" point you have. |
| **Dashboard = `computeDashboardStats(checkins)`** | Derived and memoized, never stored. It updates automatically on create, edit or delete because it reads the same query cache. |
| **Expo Router (file-based navigation)** | It's Expo's default and recommended router, and it's built on React Navigation underneath. Every route is also a URL, so `healthtracker://checkin/123` maps to `src/app/checkin/[id]/index.tsx` on cold and warm start with no linking config. `Stack.Protected` gives declarative auth gating. |
| **Pending deep link through login** | When a signed-out user opens a link, the guard sends them to Login and the target would be lost. We save it in `authStore.pendingDeepLink` and `router.push` to it after login. `unstable_settings.initialRouteName = '(tabs)'` means Back from a deep-linked detail screen goes to the tabs instead of exiting the app. |
| **Apple Health visual language** | A recognizable, restrained reference with system-style grouped cards, category colors and big numbers. It doesn't look AI-generated, and dark mode comes almost for free from the tokens. |

---

## Phase 0: Environment & scaffold (25 min)

**You do (manual):**
1. Install Node LTS and **Android Studio**. In its SDK Manager, install the latest Android SDK, Platform-Tools and Build-Tools. Set `ANDROID_HOME`, and add `platform-tools` to PATH.
2. On the phone, enable **Developer options**, then **USB debugging**. Plug it in, then run `adb devices` and accept the prompt on the phone.
3. Scaffold (done ✅). If the template has example screens, run `npm run reset-project` to get a blank `src/app/` folder.
4. Copy `CLAUDE.md` and `PLAN.md` into the root, next to the generated `AGENTS.md`. Keep AGENTS.md. Open the folder in VS Code and start Claude Code. Don't run `/init`.

**Prompt:**
```
Read CLAUDE.md, PLAN.md and AGENTS.md. Do Phase 0 only.
1. Install every dependency in the CLAUDE.md tech stack using `npx expo install` (runtime) and dev deps (jest-expo, jest, @types/jest, @testing-library/react-native). Expo Router is already installed; do NOT add @react-navigation/* packages directly unless expo-router needs a peer. Include react-native-screens, react-native-safe-area-context, react-native-svg, react-native-gesture-handler, expo-linking, zustand, @react-native-async-storage/async-storage, expo-secure-store, @react-native-community/netinfo, @react-native-community/datetimepicker, react-hook-form, zod, @hookform/resolvers, date-fns, expo-crypto, @expo-google-fonts/inter, expo-font, expo-splash-screen.
2. In app.json set name "Health Tracker", slug, scheme "healthtracker", android.package "com.<myname>.healthtracker", userInterfaceStyle "automatic".
3. Turn on strict TS, make sure the "@/*" path alias points to "./src/*" (the template may already have it), and configure Jest with the jest-expo preset plus the AsyncStorage jest mock.
4. Create the empty folder structure from CLAUDE.md (everything under src/, routes in src/app/). If example screens/components from the template remain, delete them. src/app/(tabs)/index.tsx shows a plain "Hello Health" text for now.
5. Add npm scripts: test, typecheck, android.
6. Add one trivial test (src/domain/sanity.test.ts) so I can confirm Jest runs.
Then tell me the exact commands to verify.
```

**Checkpoint ✅**
- [ ] `npm test` passes the sanity test
- [ ] `npx tsc --noEmit` and `npx expo lint`: no errors
- [ ] `npx expo-doctor`: no failed checks
- [ ] `npx expo run:android` builds and installs the **dev client** on your phone, and the app opens (first build takes 5–10 min, so start Phase 1 reading while it runs)
- [ ] Editing `src/app/(tabs)/index.tsx` hot-reloads on the phone
- [ ] `adb shell am start -a android.intent.action.VIEW -d "healthtracker://test"` opens the app (proves the scheme is registered)

**Commit:** `chore: add dependencies, strict TS, jest, folder structure`

> If the Gradle build fails, fix it now. Typical causes are a wrong JDK (use the one bundled with Android Studio, i.e. set `JAVA_HOME` to Android Studio's `jbr`), a missing `ANDROID_HOME`, or a missing SDK platform.

---

## Phase 1: Design system & UI kit (30 min)

**Prompt:**
```
Phase 1 only. Build the theme and UI kit exactly per the CLAUDE.md design system (Apple Health inspired).
- src/theme: colors (light+dark tokens), typography (Inter, the scale listed), spacing (8pt), useTheme() hook using useColorScheme.
- Load Inter fonts in src/app/_layout.tsx with expo-splash-screen held until fonts load.
- src/components/ui: Text (variant prop maps to typography, color prop maps to token), Screen (safe area + grouped background + optional ScrollView), LargeTitleHeader (34pt title + optional right avatar/button), Card, Button (primary/secondary/destructive, loading state shows spinner and disables), TextField (label, error text below in destructive color, accessible), SegmentedControl (pill track, animated thumb), Chip (selectable, for mood filters), Badge, ListRow (inset-grouped row with chevron).
- src/components/states: LoadingState, ErrorState (message + Retry button), EmptyState (icon, title, message, optional action), OfflineBanner (placeholder, just UI).
- src/components/checkins/MetricTile: Apple Health Summary tile with icon + category label in category color, timestamp right, big value + unit.
Create a temporary src/screens/KitchenSinkScreen.tsx rendering every component, and render it from src/app/(tabs)/index.tsx.
```

**Checkpoint ✅**
- [ ] Kitchen sink looks like Apple Health: grey grouped background, white shadowless cards, big bold numbers with grey units, colored category labels
- [ ] Switch the phone to dark mode: everything flips cleanly and no text is unreadable
- [ ] The Button loading state shows a spinner and ignores taps
- [ ] TextField error shows red text under the field
- [ ] No emoji, gradients or shadows anywhere

**Commit:** `feat(ui): Apple Health inspired theme and reusable component kit`

---

## Phase 2: Domain logic + unit tests (30 min)

The logic comes first so later screens can just call tested functions.

**Prompt:**
```
Phase 2 only. Pure TypeScript, no React.
1. src/types: checkin.ts (per CLAUDE.md data model), auth.ts, api.ts.
2. src/utils/errors.ts: ApiError(status), NetworkError, NotFoundError, plus isNetworkError().
3. src/domain/health.ts:
   - calculateBMI(weightKg, heightCm) -> number rounded to 1dp; throws/returns null on invalid input
   - getBMICategory(bmi) -> 'Underweight' | 'Normal' | 'Overweight' | 'Obese' (WHO cut-offs)
   - computeDashboardStats(checkins) -> { current, starting, difference, trend: 'up'|'down'|'same'|null, bmi, bmiCategory, total, latestDate, history: {date, weightKg}[] sorted ascending } using checkinDate ordering (not createdAt). Return a clear empty shape for [] and handle a single check-in (difference 0, trend 'same').
4. src/domain/validation.ts: zod checkinFormSchema. Form values are strings from inputs, so coerce numbers. Rules: weight 20–400, height 50–272, sleep 0–24, steps integer >= 0 and <= 100000, water > 0 and <= 10, mood required enum, notes optional max 500, checkinDate a valid date and not in the future. Human-friendly messages ("Weight must be between 20 and 400 kg"). Also loginSchema (valid email, password min 6).
5. src/domain/filters.ts: applyFilters(checkins, { sort: 'latest'|'oldest', moods: Mood[], from?: Date, to?: Date }) with inclusive date range by day.
6. Thorough tests for all of the above: health.test.ts, validation.test.ts, filters.test.ts. Include edge cases: empty list, single item, unsorted input, same-day items, boundary values, negative steps, '' required fields, 'abc' numbers, future dates, decimal steps.
Delete the sanity test.
```

**Checkpoint ✅**
- [ ] `npm test`: all green. Read the test names, they should make sense to you
- [ ] Check one BMI by hand: 70 kg, 175 cm should give **22.9 (Normal)**
- [ ] `npx tsc --noEmit` is clean

**Commit:** `feat(domain): BMI/progress calculations, validation schemas, filters with tests`

---

## Phase 3: Storage, mock API, auth & navigation (45 min)

**Prompt:**
```
Phase 3 only.
1. src/storage: typed JSON wrapper over AsyncStorage (getItem<T>, setItem, removeItem) with try/catch; secureStorage.ts over expo-secure-store for the auth token; keys.ts with all keys namespaced ("ht:").
2. src/api/mockServer.ts: simulates a remote REST server.
   - Its own persisted DB under key "ht:mock-server-db" (NOT the client cache).
   - Users: demo@health.app / Password123 (seeded with ~10 check-ins over the last 60 days, a realistic slow weight drop from 78 to 74 kg, varied moods), and new@health.app / Password123 (no check-ins, used to demo empty states).
   - Each request: random latency 600–1500ms; check NetInfo.fetch() and throw NetworkError if offline; configurable failureRate (default 0) that throws ApiError(500).
   - Endpoints as functions: login, getCheckins, getCheckin(id) (404 -> NotFoundError), createCheckin (idempotent: if clientId already exists return the existing record), updateCheckin, deleteCheckin. Checkins scoped by userId from token.
   - Export a devConfig { latencyMs, failureRate, forceOffline } that can be changed at runtime.
3. src/api/authApi.ts and checkinsApi.ts: thin typed functions that call the mock server, the only thing the app imports.
4. src/stores/authStore.ts (Zustand): { status: 'hydrating'|'signedOut'|'signedIn', user, token, pendingDeepLink, login(), logout(), hydrate() }. Token in SecureStore, user in AsyncStorage. logout clears token and user (later phases add: checkinsStore, outboxStore, filterStore resets; give each store a reset() now).
   LoginScreen uses a custom useLogin() hook: { login, isSubmitting, error } with a useRef lock against double submit.
5. Expo Router setup per the src/app/ tree in CLAUDE.md:
   - src/app/_layout.tsx: call authStore.hydrate() once; keep the splash screen visible while status === 'hydrating' (no login flash). Then <Stack> with
     <Stack.Protected guard={status === 'signedIn'}> (tabs), checkin/new, checkin/[id]/index, checkin/[id]/edit </Stack.Protected>
     <Stack.Protected guard={status === 'signedOut'}> login </Stack.Protected>
   - export const unstable_settings = { initialRouteName: '(tabs)' } so a deep-linked detail screen has the tabs beneath it.
   - checkin/new and checkin/[id]/edit use presentation: 'modal'.
   - (tabs)/_layout.tsx: two tabs, Summary (heart icon) and Check-ins (list icon), Apple-style tab bar (tint color, hairline top border).
   - Route files are thin: they render the screen component from src/screens. Placeholder screens for now except Login.
6. LoginScreen: Apple style large title "Health" with a heart icon in brand color, inset-grouped email/password fields, react-hook-form + loginSchema, inline errors, server error ("Incorrect email or password") shown under the form, Button disabled + spinner while submitting (no double submit), keyboard handling (KeyboardAvoidingView, returnKeyType next/go). Small footnote showing demo credentials.
7. Summary tab placeholder: LargeTitleHeader with avatar button that opens an action sheet / Alert with "Sign out".
Stop rendering the kitchen sink from the Summary tab (keep the file for reference or delete it).
```

**Checkpoint ✅**
- [ ] Empty email and a bad email format each show inline errors, and the password `123` shows the min-length error
- [ ] A wrong password shows the server error after the delay, with a spinner while waiting
- [ ] Tapping Sign in rapidly fires **one** request (add a `console.log` in mockServer.login to check)
- [ ] Correct login takes you to the Summary tab
- [ ] **Kill the app** (swipe away) and reopen: still signed in, and no flash of the login screen
- [ ] Sign out goes back to Login, and reopening the app stays signed out

**Commit:** `feat(auth): mock API server, persisted session, auth-gated navigation`

---

## Phase 4: Check-ins CRUD with custom hooks (70 min)

**Prompt:**
```
Phase 4 only (online behavior; offline comes in Phase 6, but keep the shape ready for it). NO React Query. Follow the "Custom data-hook contract" in CLAUDE.md exactly.
1. src/utils/retry.ts: withRetry(fn, { retries = 2, baseDelayMs = 500, shouldRetry }) with exponential backoff (500, 1000...). Do NOT retry NotFoundError or 4xx; retry NetworkError/5xx. Tests in retry.test.ts using jest fake timers.
2. src/services/checkinRepository.ts: getAll, getById, create(input) (generates clientId with expo-crypto), update, remove. Wraps checkinsApi calls in withRetry (reads only; never auto-retry create, since sync handles that).
3. src/stores/checkinsStore.ts (Zustand, no persist yet): { items: Record<string, Checkin>, order: string[] OR simply items: Checkin[], status: AsyncStatus, error, lastFetchedAt, ownerUserId, fetchAll(), upsert(c), removeLocal(id), reset() }.
   fetchAll keeps a module-level inFlight promise so concurrent callers share one request; it ignores the result if ownerUserId changed (logout during fetch).
4. src/hooks (custom, thin):
   - useCheckins(): selects state with useShallow, calls fetchAll on mount if never fetched or stale (>30s), returns { data, status, error, isRefreshing, refetch }.
   - useCheckin(id): local state; first returns the item from checkinsStore instantly if present (no spinner), then fetches detail in the background; NotFoundError -> status 'notFound'. Uses an isMounted/requestId guard.
   - useSubmitLock(): returns { run(fn), isSubmitting } using a useRef lock + state; run() returns early while locked.
   - useCreateCheckin / useUpdateCheckin / useDeleteCheckin built on useSubmitLock; on success upsert/remove in checkinsStore (so list + dashboard update instantly). Delete is optimistic: remove first, restore the item on error and show the error.
5. CheckinListScreen ("Check-ins" large title, "+" header button -> router.push('/checkin/new'); row tap -> router.push(`/checkin/${id}`)):
   - FlatList of memoized CheckinRow (Apple inset-grouped style: date as headline, a row of small colored metric values weight/steps/sleep/water, mood icon (Ionicons happy/remove-circle/sad outline in mind color), chevron).
   - Toolbar above list: SegmentedControl Latest|Oldest, horizontal mood Chips (multi-select), "Date range" chip that opens from/to date pickers, with a "Clear" action. Filter state in src/stores/filterStore.ts; list = useMemo(applyFilters(...)).
   - States: LoadingState first load only; ErrorState with Retry (refetch); if refetch fails but cached data exists, keep the list and show a small inline error bar instead; EmptyState "No check-ins yet" + "Add check-in" button; a different EmptyState "No check-ins match your filters" + "Clear filters".
6. CheckinDetailScreen (id from useLocalSearchParams): grouped sections like Apple Health's data detail. Big weight header, then rows for height, BMI, sleep, steps, water, mood, notes, date. Header "Edit" button; destructive "Delete Check-in" row at the bottom with a confirm Alert. Loading/error states; NotFoundError shows "Check-in not found" EmptyState with "Back to Check-ins".
7. CheckinFormScreen (one component used by both src/app/checkin/new.tsx and src/app/checkin/[id]/edit.tsx via a mode prop): react-hook-form + checkinFormSchema, numeric keyboards, MoodPicker (three large selectable tiles with icons + labels), date field opening datetimepicker (maximumDate today), notes multiline with char counter. Prefill height from the latest check-in on create. Save button in header and bottom; disabled + spinner while isSubmitting (useSubmitLock = duplicate prevention). On error show an inline banner with Retry; keep the user's input. On success router.back().
8. Accessibility labels on all rows/buttons.
```

**Checkpoint ✅**
- [ ] The list loads with a spinner, then shows about 10 seeded items (log in as demo)
- [ ] Latest/Oldest flips the order, mood chips filter, the date range filters, and Clear resets
- [ ] Logged in as `new@health.app`: the "No check-ins yet" empty state shows
- [ ] Create: an empty submit shows errors on all required fields, steps `-5`, sleep `30` and water `0` each show the right messages, and a future date can't be picked
- [ ] **Double-tap Save** creates exactly one item
- [ ] Edit an item: the change shows in both the detail screen and the list
- [ ] Delete: confirm, then the item disappears immediately
- [ ] Set `devConfig.failureRate = 1` temporarily: you get an error state, Retry works once it's back to 0, and form input is kept after a failed save
- [ ] Scrolling is smooth
- [ ] Open the list, go to Summary, come back: no second spinner (the cache is fresh), and a pull or a Retry refetches
- [ ] Add a `console.log` in mockServer.getCheckins: opening the app fires **one** request even though Summary and the list both use `useCheckins`
- [ ] `npm test` passes, including retry.test.ts

**Commit:** `feat(checkins): list with sort/filter, detail, create/edit/delete via custom hooks`
(Fine to split into 2–3 commits: list, detail, form.)

---

## Phase 5: Dashboard (40 min)

**Prompt:**
```
Phase 5 only. SummaryScreen (Apple Health "Summary" tab).
- hooks/useDashboardStats: reads the same useCheckins() data and returns useMemo(() => computeDashboardStats(data), [data]). No separate stored stats, so any upsert/remove in checkinsStore re-renders the dashboard automatically.
- Layout: LargeTitleHeader "Summary" + avatar (sign out). Section title "Highlights".
- Hero card: "Weight" in body purple. Current weight as big number; trend line with arrow icon + sentence, e.g. "Down 3.6 kg since you started" (green arrow-down) / "Up 1.2 kg since you started" (orange) / "No change yet". Never color-only.
- WeightChart (react-native-svg, custom): smooth line in body purple, light area fill at 12% opacity, dots on points, min/max y labels, first/last date x labels, last point highlighted. SegmentedControl W / M / 6M / All filters the history range. Handle 1 point (single dot) and 0 points.
- 2-column grid of MetricTiles: Starting weight, Weight change, BMI (+category as caption), Total check-ins, Latest check-in (relative date: "Today", "3 days ago").
- Empty state (no check-ins): friendly EmptyState with heart icon, "Start tracking your progress", button "Add your first check-in".
- Loading and error (Retry) states. Pull-to-refresh with RefreshControl.
- Accessibility: each tile has a sentence label; the chart has an accessibilityLabel summarizing the trend.
```

**Checkpoint ✅**
- [ ] Numbers match the seed data (check current minus starting by hand)
- [ ] Add a check-in with a much higher weight, go back to Summary: the numbers, trend text and chart all update **with no manual refresh**
- [ ] Edit that weight down, then delete it: the dashboard follows each time
- [ ] The `new@health.app` account shows the empty dashboard. Add one check-in: you see a single dot and "No change yet"
- [ ] Chart range W/M/6M/All works
- [ ] Turn on TalkBack and swipe through the tiles: they read as sentences

**Commit:** `feat(dashboard): derived health stats, weight trend chart, empty states`

---

## Phase 6: Offline persistence & sync (60 min, the highest-weighted part)

**Prompt:**
```
Phase 6 only. Implement offline per CLAUDE.md.
1. Network: stores/networkStore.ts { isOnline, lastChangedAt } fed by a NetInfo.addEventListener started once in App root (treat isInternetReachable === false as offline). Respect mockServer devConfig.forceOffline too.
2. Offline reads: add Zustand persist middleware to checkinsStore (createJSONStorage(() => AsyncStorage), name "ht:checkins-cache", partialize to { items, lastFetchedAt, ownerUserId }, version 1). Expose a hasHydrated flag; screens wait for hydration before deciding "empty". When offline, useCheckins skips fetching and returns cached data; status 'error' with NetworkError but cached data present -> show data + offline banner, not an error screen. useCheckin(id) falls back to the cached item offline.
3. stores/outboxStore.ts (Zustand + persist to AsyncStorage): items: Checkin[] with syncStatus 'pending'|'failed', plus add, update (for editing a pending item), remove, markFailed, markSynced(clientId).
4. checkinRepository.create: if offline -> add to outbox as { id: "local_"+clientId, syncStatus: 'pending' } and return it. If online -> call API; if it fails with NetworkError -> fall back to outbox; other errors -> throw (form shows error + retry).
   Editing/deleting a pending item modifies the outbox only. Editing/deleting a synced item while offline -> show "You're offline. Reconnect to edit synced check-ins." (documented limitation).
5. hooks/useCheckins: return merged list = outbox items + server items, deduped by clientId, via useMemo. Dashboard uses the same merged list so pending items count.
6. src/domain/sync.ts: pure async syncOutbox(items, createFn, now) -> { synced: {clientId, serverCheckin}[], failed: {clientId, error, attempts, nextRetryAt}[] }. Processes sequentially in checkinDate order; one failure doesn't stop others; exponential backoff nextRetryAt = now + min(2^attempts * 2000, 60000); skips items whose nextRetryAt is in the future unless force=true.
7. src/services/syncService.ts: runSync({force}) with an in-flight lock (no concurrent runs), calls syncOutbox, then for each synced result in ONE batch: remove from outboxStore and upsert the server record into checkinsStore (removal and insert in the same tick so the item never flickers or duplicates). Then a background checkinsStore.fetchAll().
8. hooks/useNetworkSync (mounted once when signed in): triggers runSync on offline->online transition, on app foreground (AppState), and on login.
9. UI: OfflineBanner under headers when offline ("You're offline. New check-ins will sync when you reconnect."). SyncBadge on rows and detail: pending = orange clock "Pending sync"; failed = red "Sync failed" + tappable "Retry" (runSync force); synced = nothing in list, small green check "Synced" in detail. Toast/inline note "Synced 2 check-ins" after successful sync.
10. Tests: src/domain/sync.test.ts covering all succeed, partial failure, all fail, backoff skip + force, ordering, idempotent retry (createFn that succeeded server-side but threw: second call returns same record, no duplicate), empty outbox. Also outbox merge/dedupe test.
```

**Checkpoint ✅**: test these exact scenarios on the phone
- [ ] **Offline read:** open the list online, enable **airplane mode**, kill and reopen the app: the list and dashboard still show cached data, plus the offline banner
- [ ] **Offline create:** still in airplane mode, add 2 check-ins: they appear at once with the orange "Pending sync" badge, and the dashboard counts them
- [ ] **Auto sync:** turn airplane mode off: within a few seconds the badges disappear and "Synced 2 check-ins" shows. Kill and reopen: no duplicates
- [ ] **Failed + retry:** set `failureRate = 1`, create offline, then go online: it shows red "Sync failed". Set `failureRate = 0`, tap Retry: it syncs
- [ ] **Pending survives restart:** create offline, kill the app, reopen it still offline: the item is still pending
- [ ] Edit a pending item while offline: it works. Edit a synced item while offline: you see a clear message
- [ ] `npm test`: all green, including the sync tests

**Commit (split):** `feat(offline): persisted check-in cache and network status` → `feat(sync): outbox, idempotent sync engine with backoff and tests` → `feat(sync): sync status badges, offline banner, retry`

> **Tip:** temporarily add a hidden **Developer** section (long-press the avatar) with toggles for forceOffline, failureRate and latency. It makes the demo recording much easier, and reviewers like it.

---

## Phase 7: Deep linking (30 min)

**Prompt:**
```
Phase 7 only. Deep link healthtracker://checkin/:id with Expo Router.
Expo Router already maps healthtracker://checkin/123 -> src/app/checkin/[id]/index.tsx on cold AND warm start (scheme set in app.json). Our job is the auth gating, the pending link and the edge cases:
1. src/domain/deepLink.ts: pure parseDeepLink(url) -> { type: 'checkin', id } | null (handles trailing slash, query strings, missing id, wrong path, garbage). Unit tests in deepLink.test.ts.
2. hooks/useDeepLinkHandler (mounted once in src/app/_layout.tsx):
   - const url = Linking.useURL() from expo-linking (initial URL on cold start, then each new URL on warm start).
   - If status is 'signedOut' (or still 'hydrating') and parseDeepLink(url) is a checkin -> authStore.setPendingDeepLink(id). Stack.Protected will show Login.
   - When status becomes 'signedIn' and pendingDeepLink exists -> router.push(`/checkin/${id}`) and clear it (exactly once; guard with a ref).
   - LoginScreen shows a small note "Sign in to open the shared check-in" when pendingDeepLink is set.
3. Back behavior: unstable_settings.initialRouteName = '(tabs)' in src/app/_layout.tsx, so Back from a deep-linked detail goes to the tabs, not out of the app. Verify.
4. CheckinDetail must handle ids for: server items, local pending items (look in outbox first), and non-existent ids -> "Check-in not found" state with "Go to Check-ins" (router.replace('/(tabs)/checkins')).
5. src/app/+not-found.tsx: friendly screen for unknown paths (e.g. healthtracker://whatever) with a button home.
6. Add the adb test commands to the README draft.
```

**Checkpoint ✅** (set `PKG=com.<myname>.healthtracker`, and get a real id from the detail screen or a console log)
- [ ] **Warm, signed in:** app open, run `adb shell am start -W -a android.intent.action.VIEW -d "healthtracker://checkin/ck_3" $PKG`: the detail screen opens, and Back goes to the list
- [ ] **Cold, signed in:** `adb shell am force-stop $PKG` then the same command: it opens straight to the detail screen
- [ ] **Cold, signed out:** sign out, force-stop, run the link: Login shows the note, and logging in lands on the detail screen
- [ ] **Not found:** `healthtracker://checkin/doesnotexist` shows the not-found state, not a crash
- [ ] **Unknown path:** `healthtracker://banana` shows the +not-found screen
- [ ] Test cold start again on a **release build** (`npx expo run:android --variant release`), because the dev client's launcher can swallow cold-start URLs

**Commit:** `feat(deeplink): checkin deep link with cold/warm start and auth gating`

---

## Phase 8: Hardening & polish (25 min)

**Prompt:**
```
Phase 8 only. Review pass, no new features.
- Grep for any API/storage calls inside components; move them behind hooks.
- Check every screen has loading/error/empty states and every touchable has accessibility props.
- Check Zustand selectors are granular; CheckinRow is memoized; no inline objects/functions causing FlatList row re-renders.
- Add a top-level ErrorBoundary with a "Something went wrong · Restart" screen.
- Remove console.logs (keep a tiny logger util if useful), remove dead code, fix all TS and lint warnings.
- Confirm logout calls reset() on checkinsStore, outboxStore, filterStore and clears their persisted AsyncStorage keys.
- Confirm no setState-after-unmount warnings in custom hooks (navigate away mid-fetch).
List anything you found and fixed.
```

**Checkpoint ✅**: run the full flow once from a clean install (uninstall, then reinstall)
- [ ] `npm test`, `npx tsc --noEmit` and `npx expo lint` are clean
- [ ] Logging out of demo and into new@ shows **no data leaking** from demo

**Commit:** `refactor: hardening pass: error boundary, a11y, re-render fixes`

---

## Phase 9: Bonus, only if you're ahead (0–30 min)

Pick from the top down and stop when time runs out:
1. ✅ **Dark mode** is already done through the tokens. Just mention it.
2. ✅ **Pull-to-refresh** (Dashboard, and add it to the list too: 5 min)
3. ✅ **Sync retry/backoff** is already in Phase 6. Mention it.
4. **Basic animations**: `LayoutAnimation` on list filter changes, and react-native-reanimated `FadeIn` entering animations on cards (10 min)
5. **Crash/error logging**: ErrorBoundary + `logger.error` hook that's ready for Sentry (5 min)
6. **Pagination**: `getCheckins({ cursor, limit })` in the mock server + `loadMore()` in checkinsStore + FlatList `onEndReached` (20 min)

**Commit:** `feat: <bonus name>`

---

## Phase 10: Deliverables (30 min)

**Prompt:**
```
Write README.md with sections: Overview + screenshots placeholder; Setup & run (prereqs, install, `npx expo run:android`, demo accounts, how to run tests, APK install); Architecture overview (layer diagram in ASCII: Screens -> Hooks -> Services/Repository -> API (mock server) / Storage; stores alongside); Project structure; Key technical decisions & trade-offs (use the table in PLAN.md); State management (why Zustand + custom hooks over Redux Toolkit / React Query; server cache vs outbox vs UI state; how changes propagate to dashboard & list; loading/error/retry handling; in-flight request dedupe; re-render avoidance); Offline storage & synchronization (persisted checkinsStore, outbox, merge/dedupe, triggers, lock, idempotency via clientId, backoff, retry, status lifecycle diagram pending -> synced / failed -> pending); Deep linking (cold/warm/auth-gated/not-found, adb commands); Testing (what's covered and why); Assumptions & limitations (mock server on-device, offline edits of synced items blocked, no conflict resolution, single device, last-write-wins); What I'd improve with more time; AI tools used (Claude in planning + Claude Code in VS Code, describe honestly how it was used and what I reviewed/changed myself).
```

**You do (manual):**
1. **APK** (local and free):
   ```bash
   npx expo prebuild --platform android   # if the android/ folder doesn't already exist
   cd android && ./gradlew assembleRelease
   # output: android/app/build/outputs/apk/release/app-release.apk
   ```
   The default release build is signed with the debug keystore, which is fine for a sideload APK. Install it on the phone (`adb install -r ...`) and test it once. Alternative: `eas build -p android --profile preview` (needs an Expo account, and the build queue can be slow).
2. **Screen recording** (3–4 min, phone's built-in recorder). Order: login with a validation error, then success. Dashboard. Filter and sort the list. Create with a validation error, then save. Edit, and watch the dashboard update. Delete. Airplane mode: cached data, offline create shows Pending, then reconnect and it shows Synced. Force a sync failure and retry it. Deep link cold start and not-found (run the adb command from your laptop while recording). Kill and reopen to show the session persists. Logout.
3. Push to GitHub, and check the commit history reads well.

**Final checklist ✅**
- [ ] Every section of the assignment PDF has been covered (go through sections 1–9)
- [ ] README has all 9 required sections + the AI-usage note
- [ ] APK installs on a clean phone and works without any server
- [ ] Recording covers every major flow

---

## Interview prep: questions you should be able to answer
- Why Zustand + custom hooks instead of Redux Toolkit or React Query? What lives where?
- Two screens call `useCheckins()` at the same time. How many requests go out? (One: the shared in-flight promise.)
- What happens if the user logs out while a fetch is still in flight? (The `ownerUserId` guard drops the result.)
- Why a `useRef` lock and not just `isSubmitting` state? (State updates are async, so two taps in the same frame both see `false`.)
- Walk through what happens, step by step, when I create a check-in in airplane mode and then turn Wi-Fi on.
- What happens if the sync request succeeds on the server but the response is lost? (Idempotent `clientId`.)
- What stops two syncs running at once? (In-flight lock.)
- How does the dashboard update after an edit? (Same query cache, and the stats are derived with `useMemo`.)
- Cold vs warm deep link: how does Expo Router resolve the URL to a screen? (The file path is the URL: `getInitialURL` handles cold start, the `url` event handles warm start, and `Linking.useURL` wraps both.) What if the user isn't logged in? (`Stack.Protected` redirects to Login, the pending link is saved, and we push it after login.)
- Why Expo Router over plain React Navigation? (It's file-based, deep links come built in, routes are typed, and it's Expo's default. It's built on React Navigation, so stacks, tabs and options are the same concepts.)
- How do you prevent double submission? (`useSubmitLock`: a ref lock plus `isSubmitting` disables the button, with the idempotency key as a backstop.)
- Why is the token in SecureStore while check-ins are in AsyncStorage?
- How did you avoid unnecessary re-renders in the list?
- What are the limitations, and what would you build next? (Offline edits/deletes with an operation queue, conflict resolution, background sync with a background task, a real backend.)