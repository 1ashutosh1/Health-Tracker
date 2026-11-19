import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { IconName } from '../../types/ui';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  accessibilityLabel?: string;
}

const CHIP_HEIGHT = 36;

/** Selectable pill, used for the mood filters. */
export function Chip({ label, selected, onPress, icon, accessibilityLabel }: ChipProps) {
  const { colors } = useTheme();
  const foreground = selected ? '#FFFFFF' : colors.label;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      // 36pt chip + 4pt slop on each side = 44pt touch target.
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.tint : colors.fill },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={foreground} /> : null}
      <Text variant="subhead" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: CHIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: CHIP_HEIGHT / 2,
  },
  pressed: { opacity: 0.7 },
});
