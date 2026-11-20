import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  title?: string;
  /** The button's text. "Retry" for a failed load; the crash screen says "Restart". */
  actionLabel?: string;
}

export function ErrorState({ message, onRetry, title = 'Something went wrong', actionLabel = 'Retry' }: ErrorStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.destructive} />
      <View style={styles.text} accessible accessibilityLiveRegion="polite">
        <Text variant="headline" style={styles.centered}>
          {title}
        </Text>
        <Text variant="subhead" color="secondaryLabel" style={styles.centered}>
          {message}
        </Text>
      </View>
      <Button title={actionLabel} variant="secondary" onPress={onRetry} style={styles.button} />
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
