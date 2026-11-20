import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { SummaryTiles } from '../components/checkins/SummaryTiles';
import { WeightCard } from '../components/checkins/WeightCard';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorBanner } from '../components/states/ErrorBanner';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { OfflineBanner } from '../components/states/OfflineBanner';
import { SyncNotice } from '../components/states/SyncNotice';
import { LargeTitleHeader } from '../components/ui/LargeTitleHeader';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { filterByRange } from '../domain/chart';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useSyncNotice } from '../hooks/useSyncNotice';
import { useAuthStore } from '../stores/authStore';
import { useOutboxStore } from '../stores/outboxStore';
import { spacing } from '../theme/spacing';
import type { ChartRange } from '../types/checkin';

/** Apple Health "Summary" tab. Every number comes from useDashboardStats; this file only decides what to show. */
export function SummaryScreen() {
  throw new Error('test crash');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { stats, status, error, isRefreshing, isOffline, refetch } = useDashboardStats();
  const syncNotice = useSyncNotice();
  const unsyncedCount = useOutboxStore((s) => s.items.length);
  const [range, setRange] = useState<ChartRange>('M');

  const chartPoints = useMemo(() => filterByRange(stats.history, range, new Date()), [stats.history, range]);

  const refresh = useCallback(() => void refetch(), [refetch]);
  const addCheckin = useCallback(() => router.push('/checkin/new'), [router]);

  const openAccountMenu = () => {
    // Signing out clears this device's copy, so check-ins that never reached the server would be gone for good.
    const warning =
      unsyncedCount > 0
        ? `${unsyncedCount} check-in${unsyncedCount === 1 ? ' has' : 's have'} not synced yet and will be lost if you sign out.`
        : user?.email;
    Alert.alert(user?.name ?? 'Account', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const header = (
    <>
      <LargeTitleHeader title="Summary" onAvatarPress={openAccountMenu} />
      {isOffline || syncNotice ? (
        <View style={styles.notices}>
          {isOffline ? <OfflineBanner /> : null}
          {syncNotice ? <SyncNotice message={syncNotice} /> : null}
        </View>
      ) : null}
    </>
  );
  const hasData = stats.total > 0;
  const isFirstLoad = (status === 'idle' || status === 'loading') && !isRefreshing && !hasData;

  if (isFirstLoad) {
    return (
      <Screen>
        {header}
        <LoadingState message="Loading your summary…" />
      </Screen>
    );
  }

  if (status === 'error' && !hasData) {
    return (
      <Screen>
        {header}
        <ErrorState message={error ?? 'Could not load your summary.'} onRetry={refresh} />
      </Screen>
    );
  }

  if (!hasData) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon="heart-outline"
          iconColor="heart"
          title="Start tracking your progress"
          message="Your weight trend, BMI and check-in count will show up here."
          actionLabel="Add your first check-in"
          onAction={addCheckin}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}>
      {header}
      <View style={styles.content}>
        {/* A failed refresh with data on screen: keep the numbers, say what happened. */}
        {status === 'error' ? <ErrorBanner message={error ?? 'Could not refresh.'} onRetry={refresh} /> : null}
        <Text variant="title2" accessibilityRole="header">
          Highlights
        </Text>
        <WeightCard stats={stats} range={range} onRangeChange={setRange} chartPoints={chartPoints} />
        <SummaryTiles stats={stats} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  notices: { gap: spacing.sm, paddingBottom: spacing.md },
});
