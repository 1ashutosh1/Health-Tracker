import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import { Text } from '../ui/Text';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <View
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      <ActivityIndicator size="large" />
      <Text variant="subhead" color="secondaryLabel">
        {message}
      </Text>
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
});
