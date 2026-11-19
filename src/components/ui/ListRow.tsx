import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { resolveColor } from '../../theme/colors';
import { layout, radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { ColorToken, IconName } from '../../types/ui';
import { Text } from './Text';

interface ListGroupProps {
  children: ReactNode;
}

/** iOS inset-grouped container: rounded card, hairline separators inset 16pt between rows. */
export function ListGroup({ children }: ListGroupProps) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);

  return (
    <View style={[styles.group, { backgroundColor: colors.card }]}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

interface ListRowProps {
  title: string;
  /** Secondary text on the right, before the chevron. */
  value?: string;
  icon?: IconName;
  iconColor?: ColorToken;
  /** Rows without onPress are static: no chevron, not announced as buttons. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function ListRow({
  title,
  value,
  icon,
  iconColor = 'tint',
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const { colors } = useTheme();

  const content = (
    <>
      {icon ? <Ionicons name={icon} size={22} color={resolveColor(colors, iconColor)} /> : null}
      <Text variant="body" style={styles.title}>
        {title}
      </Text>
      {value ? (
        <Text variant="body" color="secondaryLabel">
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.tertiaryLabel} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: layout.minHitTarget + 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1 },
  pressed: { opacity: 0.6 },
});
