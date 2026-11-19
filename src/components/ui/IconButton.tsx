import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { layout } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { IconName } from '../../types/ui';

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Required: an icon alone says nothing to a screen reader. */
  accessibilityLabel: string;
}

/** A tint-colored icon in a 44x44 touch target, e.g. the "+" next to a large title. */
export function IconButton({ icon, onPress, accessibilityLabel }: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={30} color={colors.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.minHitTarget,
    height: layout.minHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
});
