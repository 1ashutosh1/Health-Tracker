import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { CategoryName, IconName } from '../../types/ui';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

interface MetricTileProps {
  icon: IconName;
  /** Drives the color of the icon and the label. Used nowhere else in the tile. */
  category: CategoryName;
  label: string;
  value: string;
  unit?: string;
  /** Already formatted, e.g. "Today" or "8:30 AM". Left out when the tile has nothing to date. */
  timestamp?: string;
  /** A small line under the number, e.g. the BMI category. */
  caption?: string;
  /** Spoken as one sentence, e.g. "Current weight, 72.4 kilograms". */
  accessibilityLabel: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Apple Health "Summary" tile: category header row, then a big number with a grey unit. */
export function MetricTile({
  icon,
  category,
  label,
  value,
  unit,
  timestamp,
  caption,
  accessibilityLabel,
  onPress,
  style,
}: MetricTileProps) {
  const { colors } = useTheme();
  const categoryColor = colors.category[category];

  const content = (
    <View style={styles.content} accessible={!onPress} accessibilityLabel={onPress ? undefined : accessibilityLabel}>
      <View style={styles.header}>
        <View style={styles.category}>
          <Ionicons name={icon} size={18} color={categoryColor} />
          <Text variant="subheadSemibold" style={{ color: categoryColor }}>
            {label}
          </Text>
        </View>
        <View style={styles.meta}>
          {timestamp ? (
            <Text variant="footnote" color="secondaryLabel">
              {timestamp}
            </Text>
          ) : null}
          {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.tertiaryLabel} /> : null}
        </View>
      </View>
      {/* One line: a long value such as "Yesterday" shrinks to fit a half-width tile instead of wrapping. */}
      <Text variant="metricValue" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
        {unit ? (
          <Text variant="subhead" color="secondaryLabel">
            {` ${unit}`}
          </Text>
        ) : null}
      </Text>
      {caption ? (
        <Text variant="footnote" color="secondaryLabel">
          {caption}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel} style={style}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
