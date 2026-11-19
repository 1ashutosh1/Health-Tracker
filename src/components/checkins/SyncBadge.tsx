import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import type { SyncStatus } from '../../types/checkin';
import { Badge } from '../ui/Badge';
import { Text } from '../ui/Text';

interface SyncBadgeProps {
  syncStatus: SyncStatus;
  /** Lists leave synced rows plain. The detail screen passes true to show the small green "Synced" check. */
  showSynced?: boolean;
  /** Shown as a "Retry" button next to a failed badge. */
  onRetry?: () => void;
}

/** Where a check-in is in its trip to the server. Always an icon plus words, never color alone. */
export function SyncBadge({ syncStatus, showSynced = false, onRetry }: SyncBadgeProps) {
  if (syncStatus === 'synced') return showSynced ? <Badge label="Synced" tone="synced" /> : null;
  if (syncStatus === 'pending') return <Badge label="Pending sync" tone="pending" />;

  return (
    <View style={styles.failed}>
      <Badge label="Sync failed" tone="failed" />
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry sync"
          // The text is small; the extra touch area brings the target up to 44pt.
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 16 }}
        >
          <Text variant="subheadSemibold" color="tint">
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  failed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
});
