import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, spacing } from '../../theme/spacing';
import { MOODS, type Mood, type SortOrder } from '../../types/checkin';
import { formatShortDate, MOOD_LABELS } from '../../utils/format';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { DateField } from '../ui/DateField';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Text } from '../ui/Text';
import { MOOD_ICONS } from './moodIcons';

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
] as const;

interface CheckinFilterBarProps {
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  moods: readonly Mood[];
  onToggleMood: (mood: Mood) => void;
  from: Date | undefined;
  to: Date | undefined;
  onFromChange: (date: Date) => void;
  onToChange: (date: Date) => void;
  /** Any mood or date filter is on. Shows the Clear action. */
  isFiltering: boolean;
  onClear: () => void;
}

/** "Nov 1 - Nov 19", "From Nov 1", "Until Nov 19" or the idle label. */
function describeRange(from: Date | undefined, to: Date | undefined): string {
  if (from && to) return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  if (from) return `From ${formatShortDate(from)}`;
  if (to) return `Until ${formatShortDate(to)}`;
  return 'Date range';
}

/** Sort control, mood chips and the date-range chip, shown above the list. Pure UI: all state comes in as props. */
export function CheckinFilterBar({
  sort,
  onSortChange,
  moods,
  onToggleMood,
  from,
  to,
  onFromChange,
  onToChange,
  isFiltering,
  onClear,
}: CheckinFilterBarProps) {
  // Whether the From/To pickers are showing is purely a UI detail, so it stays local.
  const [rangeOpen, setRangeOpen] = useState(false);
  const hasRange = from !== undefined || to !== undefined;
  const today = new Date();

  return (
    <View style={styles.container}>
      <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={onSortChange} accessibilityLabel="Sort order" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        accessibilityLabel="Filters"
      >
        {MOODS.map((mood) => (
          <Chip
            key={mood}
            label={MOOD_LABELS[mood]}
            icon={MOOD_ICONS[mood]}
            selected={moods.includes(mood)}
            onPress={() => onToggleMood(mood)}
            accessibilityLabel={`Mood ${MOOD_LABELS[mood]}`}
          />
        ))}
        <Chip
          label={describeRange(from, to)}
          icon="calendar-outline"
          selected={hasRange}
          onPress={() => setRangeOpen((open) => !open)}
          accessibilityLabel={`${describeRange(from, to)}, ${rangeOpen ? 'hide' : 'show'} date pickers`}
        />
        {isFiltering ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            style={styles.clear}
          >
            <Text variant="subheadSemibold" color="tint">
              Clear
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {rangeOpen ? (
        <Card style={styles.range}>
          <DateField
            label="From"
            value={from}
            displayValue={from ? formatShortDate(from) : 'Any date'}
            onChange={onFromChange}
            maximumDate={today}
          />
          <DateField
            label="To"
            value={to}
            displayValue={to ? formatShortDate(to) : 'Any date'}
            onChange={onToChange}
            maximumDate={today}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm + 4, paddingBottom: spacing.md },
  chips: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  clear: {
    minHeight: layout.minHitTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  range: { gap: spacing.md },
});
