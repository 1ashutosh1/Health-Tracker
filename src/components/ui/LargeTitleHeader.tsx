import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

interface LargeTitleHeaderProps {
  title: string;
  /** Shows the Apple Health style avatar circle at the top right. */
  onAvatarPress?: () => void;
  /** Replaces the avatar with any other trailing control (for example a "+" button). */
  right?: ReactNode;
}

const AVATAR_SIZE = 36;

export function LargeTitleHeader({ title, onAvatarPress, right }: LargeTitleHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {right ??
        (onAvatarPress ? (
          <Pressable
            onPress={onAvatarPress}
            accessibilityRole="button"
            accessibilityLabel="Account"
            style={styles.hitTarget}
          >
            <View style={[styles.avatar, { backgroundColor: colors.fill }]}>
              <Ionicons name="person" size={20} color={colors.secondaryLabel} />
            </View>
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minHitTarget,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { flexShrink: 1 },
  hitTarget: {
    width: layout.minHitTarget,
    height: layout.minHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
