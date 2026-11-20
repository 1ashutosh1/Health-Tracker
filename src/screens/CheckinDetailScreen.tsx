import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { MOOD_ICONS } from '../components/checkins/moodIcons';
import { MetricTile } from '../components/checkins/MetricTile';
import { SyncBadge } from '../components/checkins/SyncBadge';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorBanner } from '../components/states/ErrorBanner';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { OfflineBanner } from '../components/states/OfflineBanner';
import { Card } from '../components/ui/Card';
import { ListGroup, ListRow } from '../components/ui/ListRow';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { calculateBMI, getBMICategory } from '../domain/health';
import { useCheckin } from '../hooks/useCheckin';
import { useDeleteCheckin } from '../hooks/useCheckinMutations';
import { useRetrySync } from '../hooks/useRetrySync';
import { layout, spacing } from '../theme/spacing';
import { OFFLINE_EDIT_MESSAGE } from '../utils/errors';
import { formatCheckinDate, formatDecimal, formatSteps, MOOD_LABELS } from '../utils/format';

interface CheckinDetailScreenProps {
  id: string;
}

/** The deep-link target (healthtracker://checkin/:id): a big weight header, then the rest in grouped rows. */
export function CheckinDetailScreen({ id }: CheckinDetailScreenProps) {
  const router = useRouter();
  const { data: checkin, status, error, isOffline, refetch } = useCheckin(id);
  const { mutate: removeCheckin, isSubmitting: isDeleting, error: deleteError } = useDeleteCheckin(id);
  const retrySync = useRetrySync();

  // The server gave a just-synced check-in a new id. Move the route to it so Edit and Delete use the right one.
  useEffect(() => {
    if (checkin && checkin.id !== id) router.setParams({ id: checkin.id });
  }, [checkin, id, router]);

  const goToList = useCallback(() => router.replace('/(tabs)/checkins'), [router]);

  const deleteAndLeave = useCallback(async () => {
    const deleted = await removeCheckin();
    if (!deleted) return; // the check-in is back in the list and the reason is in deleteError
    if (router.canGoBack()) router.back();
    else goToList();
  }, [removeCheckin, router, goToList]);

  // A check-in the server already has can only be changed with a connection. Pending ones are ours to change.
  const needsConnection = isOffline && checkin?.syncStatus === 'synced';

  const confirmDelete = useCallback(() => {
    if (needsConnection) {
      Alert.alert('Offline', OFFLINE_EDIT_MESSAGE);
      return;
    }
    Alert.alert('Delete this check-in?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteAndLeave() },
    ]);
  }, [deleteAndLeave, needsConnection]);

  const openEdit = useCallback(() => {
    if (needsConnection) Alert.alert('Offline', OFFLINE_EDIT_MESSAGE);
    else router.push({ pathname: '/checkin/[id]/edit', params: { id } });
  }, [needsConnection, router, id]);

  if (status === 'notFound') {
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState
          icon="document-outline"
          title="Check-in not found"
          message="It may have been deleted, or the link is not valid."
          actionLabel="Go to Check-ins"
          onAction={goToList}
        />
      </Screen>
    );
  }

  if (!checkin) {
    return (
      <Screen edges={['left', 'right']}>
        {status === 'error' ? (
          <ErrorState message={error ?? 'Could not load this check-in.'} onRetry={() => void refetch()} />
        ) : (
          <LoadingState message="Loading check-in…" />
        )}
      </Screen>
    );
  }

  const bmi = calculateBMI(checkin.weightKg, checkin.heightCm);
  const bmiText = bmi === null ? 'Not available' : `${formatDecimal(bmi)} · ${getBMICategory(bmi)}`;
  const date = formatCheckinDate(checkin.checkinDate);

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={openEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit check-in"
              style={styles.headerButton}
            >
              <Text variant="headline" color="tint">
                Edit
              </Text>
            </Pressable>
          ),
        }}
      />

      {isOffline ? <OfflineBanner /> : null}

      {/* A failed background refresh or a refused delete: the data on screen is still good, so say what happened above it. */}
      {status === 'error' ? <ErrorBanner message={error ?? 'Could not refresh.'} onRetry={() => void refetch()} /> : null}
      {deleteError ? <ErrorBanner message={deleteError} onRetry={() => void deleteAndLeave()} /> : null}

      <View style={styles.sync}>
        <SyncBadge syncStatus={checkin.syncStatus} showSynced onRetry={retrySync} />
        {checkin.syncStatus === 'failed' && checkin.syncError ? (
          <Text variant="footnote" color="secondaryLabel" accessibilityLiveRegion="polite">
            {checkin.syncError}
          </Text>
        ) : null}
      </View>

      <MetricTile
        icon="scale-outline"
        category="body"
        label="Weight"
        value={formatDecimal(checkin.weightKg)}
        unit="kg"
        timestamp={date}
        accessibilityLabel={`Weight, ${formatDecimal(checkin.weightKg)} kilograms, ${date}`}
      />

      <ListGroup>
        <ListRow icon="resize-outline" iconColor="category.body" title="Height" value={`${formatDecimal(checkin.heightCm)} cm`} />
        <ListRow icon="body-outline" iconColor="category.body" title="BMI" value={bmiText} />
        <ListRow icon="bed-outline" iconColor="category.sleep" title="Sleep" value={`${formatDecimal(checkin.sleepHours)} hr`} />
        <ListRow icon="footsteps-outline" iconColor="category.activity" title="Steps" value={formatSteps(checkin.steps)} />
        <ListRow icon="water-outline" iconColor="category.water" title="Water" value={`${formatDecimal(checkin.waterLitres, 2)} L`} />
        <ListRow icon={MOOD_ICONS[checkin.mood]} iconColor="category.mind" title="Mood" value={MOOD_LABELS[checkin.mood]} />
        <ListRow icon="calendar-outline" iconColor="secondaryLabel" title="Date" value={date} />
      </ListGroup>

      {checkin.notes ? (
        <Card>
          <View accessible accessibilityLabel={`Notes: ${checkin.notes}`} style={styles.notes}>
            <Text variant="footnote" color="secondaryLabel">
              Notes
            </Text>
            <Text variant="body">{checkin.notes}</Text>
          </View>
        </Card>
      ) : null}

      <ListGroup>
        <ListRow
          destructive
          title="Delete Check-in"
          value={isDeleting ? 'Deleting…' : undefined}
          onPress={confirmDelete}
          accessibilityLabel="Delete check-in"
        />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.md },
  notes: { gap: spacing.xs },
  sync: { gap: spacing.xs },
  headerButton: {
    minWidth: layout.minHitTarget,
    minHeight: layout.minHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
