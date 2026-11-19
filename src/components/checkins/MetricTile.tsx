import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

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
  /** Already formatted, e.g. "Today" or "8:30 AM". */
  timestamp: string;
  /** Spoken as one sentence, e.g. "Current weight, 72.4 kilograms". */
  accessibilityLabel: string;
  onPress?: () => void;
}

/** Apple Health "Summary" tile: category header row, then a big number with a grey unit. */
export function MetricTile({
  icon,
  category,
  label,
  value,
  unit,
  timestamp,
  accessibilityLabel,
  onPress,
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
          <Text variant="footnote" color="secondaryLabel">
            {timestamp}
          </Text>
          {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.tertiaryLabel} /> : null}
        </View>
      </View>
      <Text variant="metricValue">
        {value}
        {unit ? (
          <Text variant="subhead" color="secondaryLabel">
            {` ${unit}`}
          </Text>
        ) : null}
      </Text>
    </View>
  );

  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel}>
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
