// TEMPORARY: renders every Phase 1 component. Delete once the real screens exist (Phase 4+).
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MetricTile } from '../components/checkins/MetricTile';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { OfflineBanner } from '../components/states/OfflineBanner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { LargeTitleHeader } from '../components/ui/LargeTitleHeader';
import { ListGroup, ListRow } from '../components/ui/ListRow';
import { Screen } from '../components/ui/Screen';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Text } from '../components/ui/Text';
import { TextField } from '../components/ui/TextField';
import { spacing } from '../theme/spacing';
import type { IconName } from '../types/ui';

type SortOrder = 'latest' | 'oldest';
type ChartRange = 'W' | 'M' | '6M' | 'All';
type MoodFilter = 'happy' | 'neutral' | 'sad';

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
] as const;

const RANGE_OPTIONS = [
  { value: 'W', label: 'W' },
  { value: 'M', label: 'M' },
  { value: '6M', label: '6M' },
  { value: 'All', label: 'All' },
] as const;

const MOODS: readonly { value: MoodFilter; label: string; icon: IconName }[] = [
  { value: 'happy', label: 'Happy', icon: 'happy-outline' },
  { value: 'neutral', label: 'Neutral', icon: 'remove-circle-outline' },
  { value: 'sad', label: 'Sad', icon: 'sad-outline' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title2">{title}</Text>
      {children}
    </View>
  );
}

export function KitchenSinkScreen() {
  const [sort, setSort] = useState<SortOrder>('latest');
  const [range, setRange] = useState<ChartRange>('M');
  const [moods, setMoods] = useState<readonly MoodFilter[]>(['happy']);
  const [loading, setLoading] = useState(false);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const weightError = weight.trim() === '' ? 'Enter your weight' : undefined;

  const toggleMood = (mood: MoodFilter) =>
    setMoods((current) => (current.includes(mood) ? current.filter((m) => m !== mood) : [...current, mood]));

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <Screen scroll>
      <LargeTitleHeader title="Kitchen Sink" onAvatarPress={() => {}} />

      <Section title="Offline banner">
        <OfflineBanner />
      </Section>

      <Section title="Metric tiles">
        <MetricTile
          icon="body"
          category="body"
          label="Weight"
          value="72.4"
          unit="kg"
          timestamp="Today"
          accessibilityLabel="Current weight, 72.4 kilograms"
          onPress={() => {}}
        />
        <MetricTile
          icon="walk"
          category="activity"
          label="Steps"
          value="8,432"
          unit="steps"
          timestamp="Today"
          accessibilityLabel="Steps today, 8,432"
          onPress={() => {}}
        />
        <MetricTile
          icon="moon"
          category="sleep"
          label="Sleep"
          value="7.5"
          unit="hr"
          timestamp="Last night"
          accessibilityLabel="Sleep last night, 7.5 hours"
          onPress={() => {}}
        />
        <MetricTile
          icon="water"
          category="water"
          label="Water"
          value="2.4"
          unit="L"
          timestamp="Today"
          accessibilityLabel="Water today, 2.4 litres"
        />
        <MetricTile
          icon="happy"
          category="mind"
          label="Mood"
          value="Happy"
          timestamp="Today"
          accessibilityLabel="Mood today, happy"
        />
      </Section>

      <Section title="Segmented control">
        <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={setSort} accessibilityLabel="Sort order" />
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} accessibilityLabel="Chart range" />
      </Section>

      <Section title="Chips">
        <View style={styles.row}>
          {MOODS.map((mood) => (
            <Chip
              key={mood.value}
              label={mood.label}
              icon={mood.icon}
              selected={moods.includes(mood.value)}
              onPress={() => toggleMood(mood.value)}
            />
          ))}
        </View>
      </Section>

      <Section title="Badges">
        <View style={styles.row}>
          <Badge tone="pending" label="Pending sync" />
          <Badge tone="failed" label="Sync failed · Retry" />
          <Badge tone="synced" label="Synced" />
          <Badge tone="neutral" label="Draft" />
        </View>
      </Section>

      <Section title="Buttons">
        <Button title="Save check-in" onPress={() => {}} />
        <Button title="Cancel" variant="secondary" onPress={() => {}} />
        <Button title="Delete check-in" variant="destructive" onPress={() => {}} />
        <Button title="Save (tap for 2s spinner)" loading={loading} onPress={simulateLoading} />
        <Button title="Disabled" disabled onPress={() => {}} />
      </Section>

      <Section title="Text fields">
        <TextField
          label="Weight (kg)"
          placeholder="72.4"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
          error={weightError}
        />
        <TextField
          label="Notes"
          placeholder="How are you feeling?"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Section>

      <Section title="List rows">
        <ListGroup>
          <ListRow title="Sync status" value="Up to date" icon="sync" onPress={() => {}} />
          <ListRow title="Notifications" icon="notifications" iconColor="heart" onPress={() => {}} />
          <ListRow title="App version" value="1.0.0" />
        </ListGroup>
      </Section>

      <Section title="Card">
        <Card>
          <Text variant="headline">Plain card</Text>
          <Text variant="subhead" color="secondaryLabel">
            White surface, radius 14, no shadow.
          </Text>
        </Card>
      </Section>

      <Section title="States">
        <Card style={styles.stateCard}>
          <LoadingState message="Loading check-ins…" />
        </Card>
        <Card style={styles.stateCard}>
          <ErrorState
            message={`Couldn't load your check-ins. Retried ${retryCount} times.`}
            onRetry={() => setRetryCount((count) => count + 1)}
          />
        </Card>
        <Card style={styles.stateCard}>
          <EmptyState
            icon="clipboard-outline"
            title="No check-ins yet"
            message="Add your first check-in to start tracking your progress."
            actionLabel="Add check-in"
            onAction={() => {}}
          />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm + 4, marginBottom: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // The state components use flex: 1, so give them a fixed-height box inside the scroll view.
  stateCard: { height: 260, padding: 0 },
});
