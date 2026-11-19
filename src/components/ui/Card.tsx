import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

interface CardProps {
  children: ReactNode;
  /** Makes the whole card tappable. Then an accessibilityLabel is required. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** White (or dark grey) rounded surface. Deliberately has no shadow. */
export function Card({ children, onPress, accessibilityLabel, style }: CardProps) {
  const { colors } = useTheme();
  const cardStyle = [styles.card, { backgroundColor: colors.card }, style];

  if (!onPress) return <View style={cardStyle}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
