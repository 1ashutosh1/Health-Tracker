# CLAUDE.md: Health Progress Tracker

Context for Claude Code. Read this before every task. The phase-by-phase build plan is in `PLAN.md`.

## What we're building
A React Native (Expo, TypeScript) app for tracking health check-ins: auth, a dashboard, check-in CRUD, offline support with a pending-sync outbox, and a deep link (`healthtracker://checkin/:id`).
The graders care most about **engineering quality**: separation of concerns, state management, offline sync, edge cases and tests. The UI should still look deliberate. It's modeled on **Apple Health**.

## Golden rules
1. **Work one phase at a time.** Do only the current phase from `PLAN.md`. Don't build ahead.
2. **No API or storage calls inside components.** Screens call hooks. Hooks call services, repositories or stores. Services call `api/` or `storage/`.
3. **Business logic lives in pure functions in `src/domain/`** and has Jest tests. Components only render.
4. **Don't over-abstract.** No generic base classes, DI containers or "managers" unless they're needed. Readability comes first, because the author has to explain every line in an interview.
5. **TypeScript strict.** No `any`. Export the types from `src/types/`.
6. **Every async screen handles 4 states:** loading, error (with a Retry button), empty and data.
7. **Install packages with `npx expo install <pkg>`** so versions match the SDK.
8. When a phase is done, list exactly what I should test by hand, then stop.

## Tech stack (fixed, don't swap)
| Concern | Choice |
|---|---|
| Framework | Expo (latest SDK) with a **development build** (`npx expo run:android`). Not Expo Go. |
| Navigation | React Navigation: native-stack + bottom-tabs |
| Data fetching | **Custom hooks only. NO React Query / SWR / RTK Query.** Hooks call the repository and write results into Zustand stores |
| State | Zustand (+ `persist` middleware with AsyncStorage): `authStore`, `checkinsStore` (server cache), `outboxStore` (pending sync), `networkStore`, `filterStore` |
| UI state | Local `useState` inside components; filters in `filterStore` so they survive navigation |
| Persistence | AsyncStorage (check-in cache, outbox, mock-server DB) + expo-secure-store (auth token) |
| Connectivity | @react-native-community/netinfo → `networkStore` |
| Retry | `src/utils/retry.ts`: `withRetry(fn, { retries, baseDelayMs })` with exponential backoff, used by the repository, unit tested |
| Forms | react-hook-form + zod (`zodResolver`). Schemas live in `src/domain/validation.ts` |
| Dates | date-fns, plus @react-native-community/datetimepicker |
| Chart | Custom line chart built on react-native-svg (`src/components/charts/WeightChart.tsx`) |
| Icons | @expo/vector-icons (Ionicons). **No emoji as icons.** |
| Font | Inter via @expo-google-fonts/inter |
| IDs | expo-crypto `randomUUID()` |
| Tests | jest-expo + @testing-library/react-native (logic tests come first) |

## Folder structure
```
src/
  api/            # mockServer.ts (fake remote DB, latency, failures), client.ts, checkinsApi.ts, authApi.ts
  storage/        # storage.ts (typed AsyncStorage wrapper), secureStorage.ts, keys.ts
  domain/         # health.ts (BMI, stats), validation.ts (zod), filters.ts, sync.ts (sync engine), *.test.ts
  services/       # checkinRepository.ts (online/offline routing), syncService.ts (triggers + lock)
  stores/         # authStore.ts, checkinsStore.ts, outboxStore.ts, networkStore.ts, filterStore.ts
  hooks/          # useCheckins.ts, useCheckin.ts, useCheckinMutations.ts, useSubmitLock.ts, useDashboardStats.ts, useDeepLinkHandler.ts, useNetworkSync.ts
  navigation/     # RootNavigator.tsx, MainTabs.tsx, types.ts, navigationRef.ts
  screens/        # Login, Dashboard, CheckinList, CheckinDetail, CheckinForm, NotFound
  components/
    ui/           # Text, Card, Button, TextField, SegmentedControl, Chip, Badge, ListRow, Screen, LargeTitleHeader
    states/       # LoadingState, ErrorState, EmptyState, OfflineBanner
    checkins/     # CheckinRow, SyncBadge, MoodPicker, MetricTile
    charts/       # WeightChart
  theme/          # colors.ts, typography.ts, spacing.ts, useTheme.ts
  types/          # checkin.ts, auth.ts, api.ts
  utils/          # format.ts (dates, numbers), errors.ts (ApiError, NetworkError, NotFoundError), retry.ts
```

## Custom data-hook contract
Every data hook returns the same shape, so screens stay consistent:
```ts
type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
// query hooks
{ data, status, error, isRefreshing, refetch }      // refetch() for Retry + pull-to-refresh
// mutation hooks
{ mutate, isSubmitting, error, reset }               // mutate is a no-op while isSubmitting (duplicate guard)
```
Rules for hooks:
- Fetch state (`status`, `error`, `lastFetchedAt`) lives in the store, so every screen sees the same state.
- **De-duplicate in-flight requests**: the store keeps one `inFlight` promise. A second caller awaits it instead of firing another request.
- Ignore results that arrive after unmount or after logout: check the `userId` and request token before writing.
- First load shows `loading`. A refetch while data already exists sets `isRefreshing` and keeps the old data on screen (no full-screen spinner).
- Duplicate-submit guard = `useRef` lock (synchronous) + `isSubmitting` state (for the UI). State alone is too slow for a fast double tap.

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
}
```

## Design system: Apple Health inspired
Visual reference: Apple Health "Summary" and "Browse" tabs (iOS 17/18). Look it up if you're unsure.

**Principles**
- Grouped background. White cards with **no shadows**, radius 14, 16px screen padding, 8pt spacing grid.
- **Large titles**: each tab has a 34pt bold large title ("Summary", "Check-ins") and an avatar circle at the top right.
- **Color by category**: each metric has one category color. It's used for that metric's icon, label and chart, and **nowhere else**.
- **Numbers are the hero**: value in 28–34pt bold with tabular numbers, unit in 15pt secondary gray right after it ("72.4 kg").
- Card header row: category icon + category name (semibold 15, category color) on the left; timestamp + chevron (13, secondary) on the right.
- Lists use iOS inset-grouped style: rounded group, hairline separators inset 16px, chevron on the right.
- Segmented controls (pill track, white raised thumb) for sort (Latest / Oldest) and the chart range (W / M / 6M / All).
- Primary buttons: full width, height 50, radius 12, tint fill, white semibold 17.
- **Banned**: gradients, glassmorphism, drop shadows on cards, emoji icons, centered "hero" layouts, more than one accent color per screen, placeholder lorem text.

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

category.body     #AF52DE   // weight, BMI (Body Measurements purple)
category.activity #FF6B00   // steps (Activity orange)
category.sleep    #5E5CE6   // sleep (indigo)
category.water    #32ADE6   // water (cyan)
category.mind     #30B0C7   // mood (Mental Wellbeing teal)

status.pending    #FF9F0A   // "Pending sync"
status.failed     #FF3B30   // "Sync failed · Retry"
status.synced     #34C759   // small checkmark only
trend.down        #34C759   // weight decreased
trend.up          #FF9F0A   // weight increased (neutral-warning tone, not alarming red)
```

**Typography** (Inter)
```
largeTitle 34/41 bold · title2 22/28 bold · headline 17/22 semibold · body 17/22 regular
callout 16/21 · subhead 15/20 · footnote 13/18 · caption 12/16
metricValue 32/38 bold, fontVariant ['tabular-nums']
```

## Accessibility
- Every touchable needs `accessibilityRole` and `accessibilityLabel`. Metric tiles read as a sentence ("Current weight, 72.4 kilograms").
- Minimum hit target 44x44. Don't disable font scaling. Errors are announced (`accessibilityLiveRegion="polite"` on Android).
- Never use color as the only signal: trend uses an arrow icon + text, and sync status uses icon + text.

## Performance
- `FlatList` with `keyExtractor`, a memoized `CheckinRow` (`React.memo`), `useCallback` renderItem.
- Zustand selectors (`useStore(s => s.x)`), never the whole store. To select several fields, use `useShallow` from `zustand/react/shallow`.
- Derived data (stats, filtered lists, the merged server+outbox list) uses `useMemo`. It's never stored.

## Commands
```
npx expo run:android          # build + run dev client on USB phone
npx expo start --dev-client   # restart Metro only
npm test                      # jest
npx tsc --noEmit              # typecheck. Must pass before every commit
```
