# Health Progress Tracker: Build Plan

The app was built in phases. Each phase has a fixed scope and a set of acceptance checks run on a physical Android phone before it was committed. Architecture, stack and design conventions are in `CLAUDE.md`; the reasoning behind the main decisions is in `README.md`.

---

## Phase 0: Environment and scaffold
**Scope**
- Expo TypeScript app (Expo Router template), strict TS, `@/*` path alias to `./src/*`.
- All native dependencies installed up front with `npx expo install`, so only one development build is needed.
- `app.json`: name "Health Tracker", scheme `healthtracker`, `android.package` `com.ashutosh.healthtracker`, `userInterfaceStyle: automatic`.
- Jest with the `jest-expo` preset and the AsyncStorage mock. Empty folder structure under `src/`.

**Acceptance**
- `npm test`, `npx tsc --noEmit`, `npx expo lint` and `npx expo-doctor` pass.
- `npx expo run:android` installs the dev client and hot reload works.
- `adb shell am start -a android.intent.action.VIEW -d "healthtracker://test"` opens the app (scheme registered).

**Commit:** `chore: add dependencies, strict TS, jest, folder structure`

---

## Phase 1: Design system and UI kit
**Scope**
- `src/theme`: light/dark color tokens, Inter typography scale, 8pt spacing, `useTheme()`.
- Fonts loaded in the root layout with the splash screen held until ready.
- `src/components/ui`: Text, Screen, LargeTitleHeader, Card, Button (primary/secondary/destructive, loading state), TextField, SegmentedControl, Chip, Badge, ListRow.
- `src/components/states`: LoadingState, ErrorState, EmptyState, OfflineBanner. `MetricTile` for the Summary grid.

**Acceptance**
- Grouped background, shadowless cards, large numbers with gray units, category-colored labels.
- Dark mode flips cleanly with no unreadable text.
- Button loading state shows a spinner and ignores taps. TextField errors show below the field.

**Commit:** `feat(ui): Apple Health inspired theme and reusable component kit`

---

## Phase 2: Domain logic and unit tests
**Scope** (pure TypeScript, no React)
- Types in `src/types`; `ApiError`, `NetworkError`, `NotFoundError` in `src/utils/errors.ts`.
- `domain/health.ts`: `calculateBMI`, `getBMICategory` (WHO cut-offs), `computeDashboardStats` (current, starting, difference, trend, BMI, total, latest date, history), ordered by `checkinDate`.
- `domain/validation.ts`: zod `checkinFormSchema` (weight 20–400, height 50–272, sleep 0–24, steps integer 0–100000, water > 0 and ≤ 10, mood required, notes ≤ 500, date not in the future) and `loginSchema`.
- `domain/filters.ts`: `applyFilters` with sort, multi-mood and an inclusive date range.

**Acceptance**
- Tests cover empty lists, single items, unsorted and same-day input, boundary values, negative and decimal steps, empty and non-numeric fields, future dates.
- 70 kg / 175 cm gives BMI 22.9 (Normal).

**Commit:** `feat(domain): BMI/progress calculations, validation schemas, filters with tests`

---

## Phase 3: Storage, mock API, auth and navigation
**Scope**
- `src/storage`: typed AsyncStorage wrapper, SecureStore wrapper for the token, namespaced keys (`ht:`).
- `src/api/mockServer.ts`: an in-app fake REST server with its own persisted DB (`ht:mock-server-db`), 600–1500 ms latency, NetInfo-based offline errors, configurable failure rate, and idempotent create on `clientId`. Seed users `demo@health.app` (10 check-ins, 78 → 74 kg) and `new@health.app` (empty).
- `authApi` / `checkinsApi` as the only entry points. `authStore` with hydrate / login / logout and `pendingDeepLink`.
- Expo Router: `Stack.Protected` for signed-in and signed-out routes, modal create/edit, two tabs. Splash held during hydration.
- LoginScreen with react-hook-form, inline errors, server error, double-submit lock.

**Acceptance**
- Validation errors for empty email, bad format and short password; wrong password shows the server error after the delay.
- Rapid taps on Sign in send one request.
- Session survives killing the app with no login flash; sign out stays signed out after restart.

**Commit:** `feat(auth): mock API server, persisted session, auth-gated navigation`

---

## Phase 4: Check-ins CRUD with custom hooks
**Scope**
- `withRetry` with exponential backoff (network errors and 5xx only).
- `checkinRepository` (reads retried, writes not). `checkinsStore` with a shared in-flight promise and an owner-user guard.
- Hooks: `useCheckins`, `useCheckin`, `useSubmitLock`, `useCreateCheckin`, `useUpdateCheckin`, `useDeleteCheckin` (optimistic delete with rollback).
- List screen: memoized rows, Latest/Oldest sort, mood chips, date range, clear filters; loading, error, empty and filtered-empty states.
- Detail screen with edit and delete; "Check-in not found" state.
- One form screen for create and edit: numeric keyboards, mood picker, date picker capped at today, notes counter, height prefilled from the latest check-in.

**Acceptance**
- Demo account lists the seeded items; sort and filters work; `new@health.app` shows the empty state.
- Form validation messages are correct; a double tap on Save creates one item.
- Edits show in the list and detail; delete removes the item at once.
- With `failureRate = 1`: error state, Retry recovers, and form input is kept after a failed save.
- Summary and list mounting together send one request; returning to a tab within 30 s does not refetch.

**Commits:** `feat(checkins): list with sort/filter, detail, create/edit/delete via custom hooks`

---

## Phase 5: Dashboard
**Scope**
- `useDashboardStats` derives stats with `useMemo` from the same list as the list screen (nothing stored).
- Weight card with trend sentence and arrow, custom SVG `WeightChart` with W / M / 6M / All ranges, single-point and empty handling.
- Tile grid: starting weight, weight change, BMI with category, total check-ins, latest check-in.
- Empty, loading and error states; pull-to-refresh; sentence-style accessibility labels.

**Acceptance**
- Numbers match the seed data. Create, edit and delete update the dashboard with no manual refresh.
- New account shows the empty dashboard; one check-in shows a single dot and "No change yet".
- TalkBack reads the tiles as sentences.

**Commit:** `feat(dashboard): derived health stats, weight trend chart, empty states`

---

## Phase 6: Offline persistence and sync
**Scope**
- `networkStore` fed by NetInfo (`isInternetReachable === false` counts as offline).
- `checkinsStore` persisted (`ht:checkins-cache`) with a hydration flag; cached data shown offline with a banner.
- `outboxStore` persisted (`ht:outbox`) for check-ins created offline (`local_<clientId>`, `pending`).
- Repository routes creates to the outbox when offline or on a network error; pending items are editable offline, synced items are not.
- `useCheckins` merges outbox and server items, de-duplicated by `clientId`.
- Pure `syncOutbox` engine: sequential, oldest first, per-item failure, backoff `min(2^n × 2 s, 60 s)`, force option.
- `runSync` with a single-run lock; triggers on login, reconnect, app foreground and Retry.
- Sync badges (pending / failed + Retry / synced) and a "Synced N check-ins" notice.

**Acceptance**
- Airplane mode, kill and reopen: cached list and dashboard still show, with the offline banner.
- Offline creates appear as "Pending sync" and count on the dashboard; they survive a restart.
- Reconnecting syncs them with no duplicates after a restart.
- With `failureRate = 1` the item shows "Sync failed"; Retry syncs it once the failure rate is back to 0.
- Editing a pending item offline works; editing a synced item offline shows a clear message.

**Commits:** `feat(offline): persisted check-in cache and network status` → `feat(sync): outbox, idempotent sync engine with backoff and tests` → `feat(sync): sync status badges, offline banner, retry`

---

## Phase 7: Deep linking
**Scope**
- Pure `parseDeepLink` (trailing slash, query strings, missing id, wrong path, garbage) with tests.
- `useDeepLinkHandler`: saves the id while signed out and opens it once after login.
- `anchor: '(tabs)'` so Back from a deep-linked detail goes to the tabs.
- Detail screen handles server ids, pending `local_` ids and unknown ids; `+not-found` for unknown paths.

**Acceptance** (`PKG=com.ashutosh.healthtracker`)
- Warm and cold start while signed in open the detail, and Back goes to the tabs.
- Signed out: Login shows a note, and signing in lands on the detail.
- `healthtracker://checkin/doesnotexist` shows "Check-in not found"; `healthtracker://banana` shows the not-found screen.
- Cold start rechecked on a release build.

**Commit:** `feat(deeplink): checkin deep link with cold/warm start and auth gating`

---

## Phase 8: Hardening
**Scope**
- No API or storage calls in components; four states on every async screen; accessibility props on every touchable.
- Granular selectors and memoized rows.
- Root error boundary with a restart screen.
- Logout resets checkins, outbox and filter stores and clears their persisted keys.
- Mounted guards so no state is set after unmount.

**Acceptance**
- Typecheck, lint and tests clean.
- Logging out of the demo account and into `new@health.app` shows no leftover data.

**Commit:** `refactor: hardening pass: error boundary, logout cleanup, mounted guards`

---

## Phase 9: Deliverables
- README (setup, architecture, state management, offline sync, deep linking, testing, limitations, AI usage).
- Release APK: `npx expo prebuild --platform android`, then `cd android && ./gradlew assembleRelease`.
- Screen recording of the main flows: login, dashboard, list filters, create/edit/delete, offline create and sync, sync failure and retry, deep links, session persistence, logout.
