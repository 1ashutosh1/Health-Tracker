import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { buildChartGeometry } from '../../domain/chart';
import { spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { WeightPoint } from '../../types/checkin';
import { formatDecimal, formatShortIsoDate } from '../../utils/format';
import { Text } from '../ui/Text';

interface WeightChartProps {
  /** Oldest first, already filtered to the selected range. */
  points: readonly WeightPoint[];
  /** One sentence that summarizes the trend for screen readers. */
  accessibilityLabel: string;
  emptyMessage?: string;
}

const PLOT_HEIGHT = 150;
const PADDING = 10;
const MANY_POINTS = 30;

/**
 * Apple Health style line chart: smooth line, light area fill, a dot per check-in, the latest one ringed.
 * Labels are normal Text (not SVG text) so they follow the user's font size. All the math is in domain/chart.ts.
 */
export function WeightChart({
  points,
  accessibilityLabel,
  emptyMessage = 'No check-ins in this period',
}: WeightChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const color = colors.category.body;

  const geometry = useMemo(
    () => (width > 0 ? buildChartGeometry(points, { width, height: PLOT_HEIGHT, padding: PADDING }) : null),
    [points, width],
  );

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (points.length === 0) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[styles.empty, { backgroundColor: colors.fill }]}
      >
        <Text variant="footnote" color="secondaryLabel">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const isFlat = geometry ? geometry.minKg === geometry.maxKg : true;
  const dotRadius = points.length > MANY_POINTS ? 2 : 3.5;
  const lastPoint = geometry ? geometry.points[geometry.points.length - 1] : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.plotRow}>
        <View style={styles.plot} onLayout={handleLayout}>
          {geometry && lastPoint ? (
            <Svg width={width} height={PLOT_HEIGHT}>
              {/* Hairlines at the max and min label positions. */}
              <Line x1={0} x2={width} y1={PADDING} y2={PADDING} stroke={colors.separator} strokeWidth={0.5} />
              <Line
                x1={0}
                x2={width}
                y1={PLOT_HEIGHT - PADDING}
                y2={PLOT_HEIGHT - PADDING}
                stroke={colors.separator}
                strokeWidth={0.5}
              />
              {geometry.areaPath ? <Path d={geometry.areaPath} fill={color} fillOpacity={0.12} /> : null}
              {geometry.linePath ? (
                <Path
                  d={geometry.linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {geometry.points.slice(0, -1).map((p, index) => (
                <Circle key={index} cx={p.x} cy={p.y} r={dotRadius} fill={color} />
              ))}
              {/* The latest check-in: a soft halo, then a solid dot with a card-colored edge. */}
              <Circle cx={lastPoint.x} cy={lastPoint.y} r={10} fill={color} fillOpacity={0.2} />
              <Circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={5.5}
                fill={color}
                stroke={colors.card}
                strokeWidth={2}
              />
            </Svg>
          ) : null}
        </View>

        <View style={[styles.yLabels, isFlat && styles.yLabelsCentered]}>
          {geometry ? (
            <>
              <Text variant="caption" color="secondaryLabel">
                {formatDecimal(geometry.maxKg)} kg
              </Text>
              {isFlat ? null : (
                <Text variant="caption" color="secondaryLabel">
                  {formatDecimal(geometry.minKg)} kg
                </Text>
              )}
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.xLabels}>
        <Text variant="caption" color="secondaryLabel">
          {formatShortIsoDate(first.date)}
        </Text>
        {points.length > 1 ? (
          <Text variant="caption" color="secondaryLabel">
            {formatShortIsoDate(last.date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: PLOT_HEIGHT + 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plotRow: { flexDirection: 'row', height: PLOT_HEIGHT },
  plot: { flex: 1 },
  yLabels: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: spacing.sm,
  },
  yLabelsCentered: { justifyContent: 'center' },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
