# CLAUDE.md: Health Progress Tracker

Project conventions: architecture, stack, data contracts and design system. The build plan is in `PLAN.md`.

## Overview
A React Native (Expo, TypeScript) app for tracking health check-ins: auth, a dashboard, check-in CRUD, offline support with a pending-sync outbox, and a deep link (`healthtracker://checkin/:id`). The visual design is modeled on **Apple Health**.

## Rules
1. **No API or storage calls inside components.** Screens call hooks. Hooks call services, repositories or stores. Services call `api/` or `storage/`.
2. **Business logic lives in pure functions in `src/domain/`** and has Jest tests. Components only render.
3. **Don't over-abstract.** No generic base classes, DI containers or "managers" unless they're needed. Readability comes first.
4. **TypeScript strict.** No `any`. Export the types from `src/types/`.
5. **Every async screen handles 4 states:** loading, error (with a Retry button), empty and data.
6. **Install packages with `npx expo install <pkg>`** so versions match the SDK.
7. **Expo specifics:** check the SDK version in package.json and the versioned Expo docs before using any Expo API (see `AGENTS.md`). Never edit `android/` by hand; configure through app.json or config plugins. Where `AGENTS.md` and this file disagree, this file wins on architecture, libraries and design.

## Tech stack
| Concern | Choice |
|---|---|
| Framework | Expo SDK 58 with a **development build** (`npx expo run:android`), not Expo Go |
| Navigation | **Expo Router** (file-based, built on React Navigation). Auth gating with `Stack.Protected`. Route files in `src/app/` stay thin and render a screen from `src/screens/` |
| Data fetching | **Custom hooks only, no React Query / SWR / RTK Query.** Hooks call the repository and write results into Zustand stores |
| State | Zustand (+ `persist` with AsyncStorage): `authStore`, `checkinsStore` (server cache), `outboxStore` (pending sync), `networkStore`, `filterStore` |
| UI state | Local `useState` inside components; filters in `filterStore` so they survive navigation |
| Persistence | AsyncStorage (check-in cache, outbox, mock-server DB) + expo-secure-store (auth token) |
| Connectivity | @react-native-community/netinfo → `networkStore` |
| Retry | `src/utils/retry.ts`: `withRetry(fn, { retries, baseDelayMs })` with exponential backoff, used by the repository for reads |
| Forms | react-hook-form + zod (`zodResolver`). Schemas live in `src/domain/validation.ts` |
| Dates | date-fns, plus @react-native-community/datetimepicker |
| Chart | Custom line chart on react-native-svg (`src/components/charts/WeightChart.tsx`) |
| Icons | @expo/vector-icons (Ionicons). No emoji as icons |
| Font | Inter via @expo-google-fonts/inter |
| IDs | expo-crypto `randomUUID()` |
| Tests | jest-expo + @testing-library/react-native |

## Folder structure
Routes go in `src/app/` (Expo Router); everything else stays outside it.
```
src/
  app/                       # Expo Router routes only (render a screen, set header options)
    _layout.tsx              # root: fonts, auth hydrate, network monitor, sync, deep-link hook, Stack + Stack.Protected
    login.tsx                # guarded: signed out only
    (tabs)/_layout.tsx       # bottom tabs: Summary, Check-ins
    (tabs)/index.tsx         # Summary (dashboard)
    (tabs)/checkins.tsx      # Check-in list
    checkin/new.tsx          # create (modal). Static route wins over [id]
    checkin/[id]/index.tsx   # detail: deep-link target healthtracker://checkin/:id
    checkin/[id]/edit.tsx    # edit (modal)
    +not-found.tsx           # unknown routes / bad deep links
  screens/        # LoginScreen, SummaryScreen, CheckinListScreen, CheckinDetailScreen, CheckinFormScreen, NotFoundScreen
  components/
    ui/           # Text, Card, Button, TextField, DateField, SegmentedControl, Chip, Badge, ListRow, Screen, LargeTitleHeader, IconButton
    states/       # LoadingState, ErrorState, ErrorBanner, EmptyState, OfflineBanner, SyncNotice, CrashScreen
    checkins/     # CheckinRow, CheckinFilterBar, SyncBadge, MoodPicker, MetricTile, SummaryTiles, WeightCard
    charts/       # WeightChart
  hooks/          # useCheckins, useCheckin, useCheckinMutations, useSubmitLock, useDashboardStats, useDeepLinkHandler, useNetworkSync, ...
  stores/         # authStore, checkinsStore, outboxStore, networkStore, filterStore
  services/       # checkinRepository (online/offline routing), syncService (run + lock), networkMonitor
  api/            # mockServer (fake remote DB, latency, failures), mockDb (seed), checkinsApi, authApi
  storage/        # storage (typed AsyncStorage wrapper), secureStorage, keys
  domain/         # health, validation, filters, sync, deepLink, chart, cache, network, checkinForm (+ *.test.ts)
  theme/          # colors, typography, spacing, useTheme
  types/          # checkin, auth, api, sync, ui
  utils/          # format, errors (ApiError, NetworkError, NotFoundError), retry, routes, logger
```
Test files never go inside `src/app/`, because Expo Router would treat them as routes.

## Data-hook contract
Every data hook returns the same shape:
```ts
type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
// query hooks
{ data, status, error, isRefreshing, refetch }      // refetch() for Retry + pull-to-refresh
// mutation hooks
{ mutate, isSubmitting, error, reset }               // mutate is a no-op while isSubmitting
```
- Fetch state (`status`, `error`, `lastFetchedAt`) lives in the store, so every screen sees the same state.
- In-flight requests are de-duplicated: the store keeps one `inFlight` promise and a second caller awaits it.
- Results that arrive after unmount or after logout are ignored (`userId` and request-token checks).
- First load shows `loading`. A refetch with data already present sets `isRefreshing` and keeps the old data on screen.
- Duplicate-submit guard = `useRef` lock (synchronous) + `isSubmitting` state (for the UI).

## Data model
```ts
type Mood = 'happy' | 'neutral' | 'sad';
type SyncStatus = 'synced' | 'pending' | 'failed';

interface Checkin {
  id: string;            // server id "ck_..." or local id "local_<uuid>"
  clientId: string;      // uuid generated on device; idempotency key, server dedupes on it
  weightKg: number;
  heightCm: number;
  sleepHours: number;    // 0–24, warn below 3 or above 14
  steps: number;         // integer >= 0
  waterLitres: number;   // > 0, <= 10
  mood: Mood;
  notes?: string;        // max 500 chars
  checkinDate: string;   // ISO date, not in the future
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus; // server items are always 'synced'
  syncError?: string;
  syncAttempts?: number;
  nextRetryAt?: number;   // outbox only: backoff
}
```

## Design system (Apple Health inspired)
Reference: Apple Health "Summary" and "Browse" tabs (iOS 17/18).

**Principles**
- Grouped background. White cards with no shadows, radius 14, 16px screen padding, 8pt spacing grid.
- Large titles: each tab has a 34pt bold large title ("Summary", "Check-ins") and an avatar circle at the top right.
- Color by category: each metric has one category color, used for that metric's icon, label and chart, and nowhere else.
- Numbers are the hero: value in 28–34pt bold with tabular numbers, unit in 15pt secondary gray ("72.4 kg").
- Card header row: category icon + category name (semibold 15, category color) on the left; timestamp + chevron (13, secondary) on the right.
- Lists use iOS inset-grouped style: rounded group, hairline separators inset 16px, chevron on the right.
- Segmented controls (pill track, white raised thumb) for sort (Latest / Oldest) and chart range (W / M / 6M / All).
- Primary buttons: full width, height 50, radius 12, tint fill, white semibold 17.
- Not used: gradients, glassmorphism, card shadows, emoji icons, centered hero layouts, more than one accent color per screen.

**Tokens** (`src/theme/colors.ts`, light / dark)
```
background        #F2F2F7 / #000000
card              #FFFFFF / #1C1C1E
cardElevated      #FFFFFF / #2C2C2E
label             #000000 / #FFFFFF
secondaryLabel    #6C6C70 / #8E8E93
tertiaryLabel     #C7C7CC / #48484A
separator         #C6C6C8 / #38383A
fill (inputs/seg) #E9E9EB / #2C2C2E
tint (buttons)    #007AFF / #0A84FF
destructive       #FF3B30 / #FF453A
heart (brand)     #FF2D55 / #FF375F

category.body     #AF52DE   // weight, BMI
category.activity #FF6B00   // steps
category.sleep    #5E5CE6   // sleep
category.water    #32ADE6   // water
category.mind     #30B0C7   // mood

status.pending    #FF9F0A   // "Pending sync"
status.failed     #FF3B30   // "Sync failed · Retry"
status.synced     #34C759   // small checkmark only
trend.down        #34C759   // weight decreased
trend.up          #FF9F0A   // weight increased
```

**Typography** (Inter)
```
largeTitle 34/41 bold · title2 22/28 bold · headline 17/22 semibold · body 17/22 regular
callout 16/21 · subhead 15/20 · footnote 13/18 · caption 12/16
metricValue 32/38 bold, fontVariant ['tabular-nums']
```

## Accessibility
- Every touchable has `accessibilityRole` and `accessibilityLabel`. Metric tiles read as a sentence ("Current weight, 72.4 kilograms").
- Minimum hit target 44x44. Font scaling stays on. Errors are announced (`accessibilityLiveRegion="polite"` on Android).
- Color is never the only signal: trend uses an arrow icon + text, and sync status uses icon + text.

## Performance
- `FlatList` with `keyExtractor`, a memoized `CheckinRow` (`React.memo`), `useCallback` renderItem.
- Zustand selectors (`useStore(s => s.x)`), never the whole store. Several fields: `useShallow` from `zustand/react/shallow`.
- Derived data (stats, filtered lists, the merged server + outbox list) uses `useMemo` and is never stored.

## Commands
```
npx expo run:android          # build + run dev client on a USB phone
npx expo start --dev-client   # restart Metro only
npm test                      # jest
npx tsc --noEmit              # typecheck
npx expo lint                 # lint. Typecheck + lint + tests pass before every commit
npx expo-doctor               # if builds or deps act weird
```
