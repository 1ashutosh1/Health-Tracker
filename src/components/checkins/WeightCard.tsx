import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { CHART_RANGES, describeChart } from '../../domain/chart';
import { describeTrend } from '../../domain/health';
import { spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { ChartRange, DashboardStats, WeightPoint } from '../../types/checkin';
import type { IconName } from '../../types/ui';
import { formatDecimal, formatRelativeDay } from '../../utils/format';
import { WeightChart } from '../charts/WeightChart';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Text } from '../ui/Text';

interface WeightCardProps {
  stats: DashboardStats;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  /** The history already narrowed to `range`. */
  chartPoints: readonly WeightPoint[];
}

const RANGE_OPTIONS = CHART_RANGES.map((r) => ({
  value: r.value,
  label: r.label,
  accessibilityLabel: r.description,
}));

/** The hero card: current weight as the big number, a trend sentence, then the range switch and chart. */
export function WeightCard({ stats, range, onRangeChange, chartPoints }: WeightCardProps) {
  const { colors } = useTheme();
  const { current, trend, difference, latestDate } = stats;
  if (current === null || latestDate === null) return null;

  const trendIcon: IconName = trend === 'down' ? 'arrow-down' : trend === 'up' ? 'arrow-up' : 'remove';
  // Color is only a hint: the arrow icon and the sentence say the same thing.
  const trendIconColor =
    trend === 'down' ? colors.trend.down : trend === 'up' ? colors.trend.up : colors.secondaryLabel;

  const summaryLabel = `Current weight, ${formatDecimal(current)} kilograms. ${describeTrend(trend, difference, 'kilograms')}.`;

  return (
    <Card>
      <View accessible accessibilityLabel={summaryLabel} style={styles.summary}>
        <View style={styles.header}>
          <View style={styles.category}>
            <Ionicons name="scale-outline" size={18} color={colors.category.body} />
            <Text variant="subheadSemibold" style={{ color: colors.category.body }}>
              Weight
            </Text>
          </View>
          <Text variant="footnote" color="secondaryLabel">
            {formatRelativeDay(latestDate)}
          </Text>
        </View>

        <Text variant="metricValue">
          {formatDecimal(current)}
          <Text variant="subhead" color="secondaryLabel">
            {' kg'}
          </Text>
        </Text>

        <View style={styles.trend}>
          <Ionicons name={trendIcon} size={16} color={trendIconColor} />
          <Text variant="subhead" color="secondaryLabel">
            {describeTrend(trend, difference)}
          </Text>
        </View>
      </View>

      <View style={styles.range}>
        <SegmentedControl
          options={RANGE_OPTIONS}
          value={range}
          onChange={onRangeChange}
          accessibilityLabel="Chart range"
        />
      </View>

      <WeightChart points={chartPoints} accessibilityLabel={describeChart(chartPoints, range)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  category: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  range: { marginVertical: spacing.md },
});
