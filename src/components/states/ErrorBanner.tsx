import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '../../theme/colors';
import { layout, radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../ui/Text';

interface ErrorBannerProps {
  message: string;
  /** Shows a Retry button when given. */
  onRetry?: () => void;
}

/**
 * A small inline error that sits above content that is still usable
 * (a cached list, or a form whose input must be kept). Full-screen failures use ErrorState.
 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: withAlpha(colors.destructive, 0.12) }]}
    >
      <Ionicons name="alert-circle" size={20} color={colors.destructive} />
      <Text variant="footnote" style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={styles.retry}
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.card,
    minHeight: layout.minHitTarget,
  },
  message: { flex: 1 },
  retry: {
    minWidth: layout.minHitTarget,
    minHeight: layout.minHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
