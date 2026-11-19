import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { typography } from '../../theme/typography';
import { layout, radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown in the destructive color under the field. */
  error?: string;
}

export function TextField({ label, error, multiline, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text variant="footnote" color="secondaryLabel" style={styles.label}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.secondaryLabel}
        selectionColor={colors.tint}
        style={[
          styles.input,
          typography.body,
          multiline && styles.multiline,
          {
            backgroundColor: colors.fill,
            color: colors.label,
            // Border is always present (transparent) so an error doesn't shift the layout.
            borderColor: error ? colors.destructive : 'transparent',
          },
        ]}
      />
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
  input: {
    minHeight: layout.controlHeight,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  multiline: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  error: { paddingHorizontal: spacing.xs },
});
