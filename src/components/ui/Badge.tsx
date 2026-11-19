import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { resolveColor, withAlpha } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { IconName, StatusName } from '../../types/ui';
import { Text } from './Text';

export type BadgeTone = StatusName | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Overrides the default icon for the tone. Every badge shows an icon, so color is never the only signal. */
  icon?: IconName;
}

const DEFAULT_ICONS: Record<BadgeTone, IconName> = {
  pending: 'time-outline',
  failed: 'alert-circle',
  synced: 'checkmark-circle',
  neutral: 'ellipse-outline',
};

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const { colors } = useTheme();
  const foreground = tone === 'neutral' ? colors.secondaryLabel : resolveColor(colors, `status.${tone}`);

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: withAlpha(foreground, 0.15) }]}
    >
      <Ionicons name={icon ?? DEFAULT_ICONS[tone]} size={14} color={foreground} />
      <Text variant="caption" style={[styles.label, { color: foreground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  label: { fontFamily: fontFamily.semibold },
});
