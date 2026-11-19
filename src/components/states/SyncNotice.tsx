import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../ui/Text';

interface SyncNoticeProps {
  /** For example "Synced 2 check-ins". */
  message: string;
}

/** A short confirmation after a sync. Neutral card with a small green check, like the rest of the app's status marks. */
export function SyncNotice({ message }: SyncNoticeProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: colors.card }]}
    >
      <Ionicons name="checkmark-circle" size={20} color={colors.status.synced} />
      <Text variant="footnote">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius.card,
  },
});
