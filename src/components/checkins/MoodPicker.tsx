import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { MOODS, type Mood } from '../../types/checkin';
import { MOOD_LABELS } from '../../utils/format';
import { Text } from '../ui/Text';
import { MOOD_ICONS } from './moodIcons';

interface MoodPickerProps {
  /** undefined until the user chooses. */
  value: Mood | undefined;
  onChange: (mood: Mood) => void;
  error?: string;
}

/** Three large tiles to pick from. The chosen tile gets a border and a tinted fill, plus `selected` for screen readers. */
export function MoodPicker({ value, onChange, error }: MoodPickerProps) {
  const { colors } = useTheme();
  const accent = colors.category.mind;

  return (
    <View style={styles.container}>
      <Text variant="footnote" color="secondaryLabel" style={styles.label}>
        Mood
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Mood" style={styles.tiles}>
        {MOODS.map((mood) => {
          const selected = value === mood;
          return (
            <Pressable
              key={mood}
              onPress={() => onChange(mood)}
              accessibilityRole="radio"
              accessibilityLabel={MOOD_LABELS[mood]}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: selected ? withAlpha(accent, 0.15) : colors.fill,
                  borderColor: selected ? accent : 'transparent',
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={MOOD_ICONS[mood]} size={32} color={selected ? accent : colors.secondaryLabel} />
              <Text variant="subhead" style={selected ? { color: accent } : undefined}>
                {MOOD_LABELS[mood]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text
          variant="footnote"
          color="destructive"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { paddingHorizontal: spacing.xs },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.control,
    borderWidth: 2,
  },
  pressed: { opacity: 0.7 },
  error: { paddingHorizontal: spacing.xs },
});
