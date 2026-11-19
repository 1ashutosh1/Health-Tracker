import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

interface DateFieldProps {
  label: string;
  /** undefined shows `placeholder`. */
  value: Date | undefined;
  onChange: (date: Date) => void;
  /** Dates after this cannot be picked. */
  maximumDate?: Date;
  /** Already formatted for display. */
  displayValue: string;
  error?: string;
}

/**
 * A field that opens the system date picker.
 * Android shows its dialog; iOS shows the inline calendar under the field.
 */
export function DateField({ label, value, onChange, maximumDate, displayValue, error }: DateFieldProps) {
  const { colors } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode: 'date',
        maximumDate,
        onValueChange: (_event, date) => onChange(date),
      });
    } else {
      setIosOpen((isOpen) => !isOpen);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="footnote" color="secondaryLabel" style={styles.label}>
        {label}
      </Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayValue}`}
        accessibilityHint="Opens the date picker"
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: colors.fill, borderColor: error ? colors.destructive : 'transparent' },
          pressed && styles.pressed,
        ]}
      >
        <Text variant="body" color={value ? 'label' : 'secondaryLabel'} style={styles.value}>
          {displayValue}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.secondaryLabel} />
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="inline"
          maximumDate={maximumDate}
          onValueChange={(_event, date) => onChange(date)}
        />
      ) : null}
      {error ? (
        <Text
          variant="footnote"
          color="destructive"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.label}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  value: { flex: 1 },
  pressed: { opacity: 0.7 },
});
