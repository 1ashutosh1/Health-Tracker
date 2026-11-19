import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { Checkin } from '../../types/checkin';
import type { CategoryName, IconName } from '../../types/ui';
import { formatCheckinDate, formatDecimal, formatSteps, MOOD_LABELS } from '../../utils/format';
import { Text } from '../ui/Text';
import { MOOD_ICONS } from './moodIcons';
import { SyncBadge } from './SyncBadge';

interface CheckinRowProps {
  checkin: Checkin;
  /** First and last rows round the group's outer corners; every other row is square. */
  isFirst: boolean;
  isLast: boolean;
  /** Must be a stable function (useCallback), or memo() can never skip a render. */
  onPress: (id: string) => void;
  /** The Retry on a failed row. Also a stable function (useCallback). */
  onRetrySync?: () => void;
}

/** Spoken after the row's summary. Synced rows say nothing extra, like their plain look. */
const SYNC_LABELS = { synced: '', pending: ' Pending sync.', failed: ' Sync failed.' } as const;

interface MetricProps {
  icon: IconName;
  category: CategoryName;
  text: string;
}

function Metric({ icon, category, text }: MetricProps) {
  const { colors } = useTheme();
  const color = colors.category[category];
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={14} color={color} />
      <Text variant="footnote" style={{ color, fontFamily: fontFamily.medium }}>
        {text}
      </Text>
    </View>
  );
}

/** One line of the inset-grouped list: the date, the four numbers in their category colors, the mood. */
function CheckinRowBase({ checkin, isFirst, isLast, onPress, onRetrySync }: CheckinRowProps) {
  const { colors } = useTheme();

  const date = formatCheckinDate(checkin.checkinDate);
  const weight = `${formatDecimal(checkin.weightKg)} kg`;
  const steps = formatSteps(checkin.steps);
  const sleep = `${formatDecimal(checkin.sleepHours)} h`;
  const water = `${formatDecimal(checkin.waterLitres, 2)} L`;

  const label =
    `${date}. Weight ${formatDecimal(checkin.weightKg)} kilograms, ${steps} steps, ` +
    `${formatDecimal(checkin.sleepHours)} hours of sleep, ${formatDecimal(checkin.waterLitres, 2)} litres of water, ` +
    `mood ${MOOD_LABELS[checkin.mood].toLowerCase()}.` +
    SYNC_LABELS[checkin.syncStatus];
  const canRetry = checkin.syncStatus === 'failed' && onRetrySync !== undefined;

  return (
    <Pressable
      onPress={() => onPress(checkin.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the check-in"
      // The badge sits inside this button, so a screen reader cannot reach its Retry. This action replaces it.
      accessibilityActions={canRetry ? [{ name: 'retry', label: 'Retry sync' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'retry') onRetrySync?.();
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card },
        isFirst && styles.first,
        isLast && styles.last,
        pressed && styles.pressed,
      ]}
    >
      {!isFirst ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}

      <View style={styles.body}>
        <Text variant="headline">{date}</Text>
        <View style={styles.metrics}>
          <Metric icon="scale-outline" category="body" text={weight} />
          <Metric icon="footsteps-outline" category="activity" text={steps} />
          <Metric icon="bed-outline" category="sleep" text={sleep} />
          <Metric icon="water-outline" category="water" text={water} />
        </View>
        <SyncBadge syncStatus={checkin.syncStatus} onRetry={onRetrySync} />
      </View>

      <Ionicons name={MOOD_ICONS[checkin.mood]} size={24} color={colors.category.mind} />
      <Ionicons name="chevron-forward" size={18} color={colors.tertiaryLabel} />
    </Pressable>
  );
}

export const CheckinRow = memo(CheckinRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  first: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  pressed: { opacity: 0.6 },
  // Hairline inset 16pt from the left, like iOS grouped lists.
  separator: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm + 4, rowGap: 2 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
