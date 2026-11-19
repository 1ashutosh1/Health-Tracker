import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { IconName } from '../../types/ui';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  /** Both must be provided to show the action button. */
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={44} color={colors.tertiaryLabel} />
      <View style={styles.text} accessible>
        <Text variant="headline" style={styles.centered}>
          {title}
        </Text>
        <Text variant="subhead" color="secondaryLabel" style={styles.centered}>
          {message}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  text: { gap: spacing.xs, alignItems: 'center' },
  centered: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.sm },
});
