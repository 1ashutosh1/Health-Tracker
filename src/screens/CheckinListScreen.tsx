import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { CheckinFilterBar } from '../components/checkins/CheckinFilterBar';
import { CheckinRow } from '../components/checkins/CheckinRow';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorBanner } from '../components/states/ErrorBanner';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { OfflineBanner } from '../components/states/OfflineBanner';
import { SyncNotice } from '../components/states/SyncNotice';
import { IconButton } from '../components/ui/IconButton';
import { LargeTitleHeader } from '../components/ui/LargeTitleHeader';
import { Screen } from '../components/ui/Screen';
import { applyFilters } from '../domain/filters';
import { useCheckinFilters } from '../hooks/useCheckinFilters';
import { useCheckins } from '../hooks/useCheckins';
import { useRetrySync } from '../hooks/useRetrySync';
import { useSyncNotice } from '../hooks/useSyncNotice';
import { spacing } from '../theme/spacing';
import type { Checkin } from '../types/checkin';
import { checkinDetailHref } from '../utils/routes';

const keyExtractor = (item: Checkin) => item.id;

export function CheckinListScreen() {
  const router = useRouter();
  const { data, status, error, isRefreshing, isOffline, refetch } = useCheckins();
  const retrySync = useRetrySync();
  const syncNotice = useSyncNotice();
  const { filters, isFiltering, setSort, toggleMood, setFrom, setTo, clearFilters } = useCheckinFilters();

  // Derived, never stored: recomputed only when the data or the filters change.
  const visible = useMemo(() => applyFilters(data, filters), [data, filters]);

  const openCheckin = useCallback((id: string) => router.push(checkinDetailHref(id)), [router]);
  const openNewCheckin = useCallback(() => router.push('/checkin/new'), [router]);
  const refresh = useCallback(() => void refetch(), [refetch]);

  const lastIndex = visible.length - 1;
  const renderItem = useCallback<ListRenderItem<Checkin>>(
    ({ item, index }) => (
      <CheckinRow
        checkin={item}
        isFirst={index === 0}
        isLast={index === lastIndex}
        onPress={openCheckin}
        onRetrySync={retrySync}
      />
    ),
    [lastIndex, openCheckin, retrySync],
  );

  const hasData = data.length > 0;
  const isFirstLoad = (status === 'idle' || status === 'loading') && !isRefreshing && !hasData;

  let body;
  if (isFirstLoad) {
    body = <LoadingState message="Loading check-ins…" />;
  } else if (status === 'error' && !hasData) {
    body = <ErrorState message={error ?? 'Could not load your check-ins.'} onRetry={refresh} />;
  } else if (!hasData) {
    body = (
      <EmptyState
        icon="list-outline"
        title="No check-ins yet"
        message="Add your first check-in to start tracking your progress."
        actionLabel="Add check-in"
        onAction={openNewCheckin}
      />
    );
  } else {
    body = (
      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshing={isRefreshing}
        onRefresh={refresh}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* A failed refresh with data on screen: keep the list, say what happened. */}
            {status === 'error' ? <ErrorBanner message={error ?? 'Could not refresh.'} onRetry={refresh} /> : null}
            <CheckinFilterBar
              sort={filters.sort}
              onSortChange={setSort}
              moods={filters.moods}
              onToggleMood={toggleMood}
              from={filters.from}
              to={filters.to}
              onFromChange={setFrom}
              onToChange={setTo}
              isFiltering={isFiltering}
              onClear={clearFilters}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="funnel-outline"
            title="No check-ins match your filters"
            message="Try a different mood or date range."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        }
      />
    );
  }

  return (
    <Screen>
      <LargeTitleHeader
        title="Check-ins"
        right={<IconButton icon="add" onPress={openNewCheckin} accessibilityLabel="Add check-in" />}
      />
      {isOffline || syncNotice ? (
        <View style={styles.notices}>
          {isOffline ? <OfflineBanner /> : null}
          {syncNotice ? <SyncNotice message={syncNotice} /> : null}
        </View>
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  notices: { gap: spacing.sm, paddingBottom: spacing.sm },
  listContent: { paddingBottom: spacing.xl },
});
