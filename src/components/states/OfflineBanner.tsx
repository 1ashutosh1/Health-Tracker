import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../ui/Text';

interface OfflineBannerProps {
  message?: string;
}

/** Placeholder: UI only. Phase 5 wires it to networkStore. */
export function OfflineBanner({
  message = "You're offline. Changes will sync when you reconnect.",
}: OfflineBannerProps) {
  const { colors } = useTheme();
  const accent = colors.status.pending;

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: withAlpha(accent, 0.15) }]}
    >
      <Ionicons name="cloud-offline-outline" size={20} color={accent} />
      <Text variant="footnote" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius.card,
  },
  message: { flex: 1 },
});
