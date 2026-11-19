import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import type { DashboardStats } from '../../types/checkin';
import type { IconName } from '../../types/ui';
import {
  formatDecimal,
  formatRelativeDay,
  formatShortIsoDate,
  formatSignedDecimal,
  formatSteps,
} from '../../utils/format';
import { MetricTile } from './MetricTile';

interface SummaryTilesProps {
  stats: DashboardStats;
}

/** The 2-column grid under the weight card. All five tiles are body measurements, so they share one color. */
export function SummaryTiles({ stats }: SummaryTilesProps) {
  const { starting, difference, trend, bmi, bmiCategory, total, latestDate, history } = stats;
  if (starting === null || difference === null || latestDate === null) return null;

  const startDate = history[0]?.date;
  const startLabel = startDate ? formatShortIsoDate(startDate) : undefined;
  const changeIcon: IconName = trend === 'down' ? 'trending-down' : trend === 'up' ? 'trending-up' : 'remove';
  const changeSentence =
    trend === 'same'
      ? 'no change since your first check-in'
      : `${trend} ${formatDecimal(Math.abs(difference))} kilograms since your first check-in`;
  const latest = formatRelativeDay(latestDate);

  return (
    <Grid>
      <MetricTile
        style={styles.fill}
        icon="flag-outline"
        category="body"
        label="Starting weight"
        value={formatDecimal(starting)}
        unit="kg"
        caption={startLabel}
        accessibilityLabel={`Starting weight, ${formatDecimal(starting)} kilograms${startLabel ? `, on ${startLabel}` : ''}`}
      />
      <MetricTile
        style={styles.fill}
        icon={changeIcon}
        category="body"
        label="Weight change"
        value={formatSignedDecimal(difference)}
        unit="kg"
        accessibilityLabel={`Weight change, ${changeSentence}`}
      />
      <MetricTile
        style={styles.fill}
        icon="body-outline"
        category="body"
        label="BMI"
        value={bmi === null ? '–' : formatDecimal(bmi)}
        caption={bmiCategory ?? undefined}
        accessibilityLabel={
          bmi === null ? 'Body mass index, not available' : `Body mass index, ${formatDecimal(bmi)}, ${bmiCategory}`
        }
      />
      <MetricTile
        style={styles.fill}
        icon="calendar-outline"
        category="body"
        label="Total check-ins"
        value={formatSteps(total)}
        unit={total === 1 ? 'check-in' : 'check-ins'}
        accessibilityLabel={`Total check-ins, ${total}`}
      />
      <MetricTile
        style={styles.fill}
        icon="time-outline"
        category="body"
        label="Latest check-in"
        value={latest}
        accessibilityLabel={`Latest check-in, ${latest}`}
      />
    </Grid>
  );
}

/** Lays children out two per row. An odd last child keeps half width instead of stretching. */
function Grid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((item, column) => (
            <View key={column} style={styles.cell}>
              {item}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
  fill: { flex: 1 },
});
