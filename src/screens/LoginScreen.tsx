import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { loginSchema, type LoginValues } from '../domain/validation';
import { useLogin } from '../hooks/useLogin';
import { usePendingDeepLink } from '../hooks/usePendingDeepLink';
import { layout, radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

interface GroupedFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** The ref is a normal prop so the email field can move focus to the password field. */
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  /** Optional control shown at the end of the row (for example the show-password eye). */
  trailing?: ReactNode;
}

/** One row of an inset-grouped form: label on the left, input filling the rest. */
function GroupedField({ label, inputRef, trailing, ...inputProps }: GroupedFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.fieldRow}>
      <Text variant="body" style={styles.fieldLabel}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.tertiaryLabel}
        selectionColor={colors.tint}
        style={[styles.fieldInput, typography.body, { color: colors.label }]}
      />
      {trailing}
    </View>
  );
}

export function LoginScreen() {
  const { colors } = useTheme();
  const { login, isSubmitting, error: serverError, reset: clearServerError } = useLogin();
  const hasPendingLink = usePendingDeepLink() !== null;
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit((values) => login(values));

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="heart" size={40} color={colors.heart} accessibilityElementsHidden />
          <Text variant="largeTitle" accessibilityRole="header">
            Health
          </Text>
          <Text variant="subhead" color="secondaryLabel">
            Sign in to track your check-ins.
          </Text>
        </View>

        {hasPendingLink ? (
          <View style={styles.pendingLink} accessible accessibilityLiveRegion="polite">
            <Ionicons name="link-outline" size={18} color={colors.secondaryLabel} />
            <Text variant="subhead" color="secondaryLabel" style={styles.pendingLinkText}>
              Sign in to open the shared check-in
            </Text>
          </View>
        ) : null}

        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <GroupedField
                label="Email"
                placeholder="name@example.com"
                value={field.value}
                onChangeText={(text) => {
                  field.onChange(text);
                  clearServerError();
                }}
                onBlur={field.onBlur}
                editable={!isSubmitting}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}
          />
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <GroupedField
                label="Password"
                placeholder="Required"
                inputRef={passwordRef}
                value={field.value}
                onChangeText={(text) => {
                  field.onChange(text);
                  clearServerError();
                }}
                onBlur={field.onBlur}
                editable={!isSubmitting}
                secureTextEntry={!showPassword}
                trailing={
                  <Pressable
                    onPress={() => setShowPassword((visible) => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={8}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={colors.secondaryLabel}
                    />
                  </Pressable>
                }
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
              />
            )}
          />
        </View>

        <View style={styles.messages}>
          {errors.email ? <FormError message={errors.email.message} /> : null}
          {errors.password ? <FormError message={errors.password.message} /> : null}
          {serverError ? <FormError message={serverError} /> : null}
        </View>

        <Button title="Sign in" onPress={() => void submit()} loading={isSubmitting} style={styles.button} />

        <View style={styles.demo}>
          <Text variant="footnote" color="secondaryLabel">
            Demo account: demo@health.app / Password123
          </Text>
          <Text variant="footnote" color="secondaryLabel">
            Empty account: new@health.app / Password123
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text
      variant="footnote"
      color="destructive"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.xl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  pendingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  pendingLinkText: { flex: 1 },
  group: { borderRadius: radius.card, overflow: 'hidden' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  fieldLabel: { width: 92 },
  fieldInput: { flex: 1, minHeight: layout.minHitTarget, paddingVertical: 0 },
  eyeButton: {
    width: layout.minHitTarget,
    height: layout.minHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md },
  messages: { gap: spacing.xs, marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  button: { marginTop: spacing.md },
  demo: { gap: spacing.xs, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
});
