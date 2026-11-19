import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import { isValid, parseISO } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, View, type KeyboardTypeOptions } from 'react-native';

import { MoodPicker } from '../components/checkins/MoodPicker';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorBanner } from '../components/states/ErrorBanner';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { Button } from '../components/ui/Button';
import { DateField } from '../components/ui/DateField';
import { Screen } from '../components/ui/Screen';
import { Text } from '../components/ui/Text';
import { TextField } from '../components/ui/TextField';
import { checkinToFormValues, getCreateDefaults, getLatestCheckin } from '../domain/checkinForm';
import { getSleepWarning } from '../domain/health';
import { checkinFormSchema, LIMITS, type CheckinFormData, type CheckinFormValues } from '../domain/validation';
import { useCheckin } from '../hooks/useCheckin';
import { useCreateCheckin, useUpdateCheckin } from '../hooks/useCheckinMutations';
import { useCheckins } from '../hooks/useCheckins';
import { layout, spacing } from '../theme/spacing';
import { useTheme } from '../theme/useTheme';
import type { CheckinFields } from '../types/checkin';
import { formatCheckinDate, toDateString } from '../utils/format';

type FormControl = Control<CheckinFormValues, unknown, CheckinFormData>;
type NumberFieldName = 'weightKg' | 'heightCm' | 'sleepHours' | 'steps' | 'waterLitres';

const NUMBER_FIELDS: readonly {
  name: NumberFieldName;
  label: string;
  placeholder: string;
  keyboardType: KeyboardTypeOptions;
}[] = [
  { name: 'weightKg', label: 'Weight (kg)', placeholder: 'e.g. 72.4', keyboardType: 'decimal-pad' },
  { name: 'heightCm', label: 'Height (cm)', placeholder: 'e.g. 175', keyboardType: 'decimal-pad' },
  { name: 'sleepHours', label: 'Sleep (hours)', placeholder: 'e.g. 7.5', keyboardType: 'decimal-pad' },
  { name: 'steps', label: 'Steps', placeholder: 'e.g. 8000', keyboardType: 'number-pad' },
  { name: 'waterLitres', label: 'Water (litres)', placeholder: 'e.g. 2', keyboardType: 'decimal-pad' },
];

interface CheckinFormScreenProps {
  mode: 'create' | 'edit';
  /** Required when mode is 'edit'. */
  checkinId?: string;
}

/** One screen for both routes. It only decides what to load; the form itself is the same. */
export function CheckinFormScreen({ mode, checkinId }: CheckinFormScreenProps) {
  if (mode === 'edit' && checkinId) return <EditForm id={checkinId} />;
  return <CreateForm />;
}

function CreateForm() {
  const { mutate, isSubmitting, error, reset } = useCreateCheckin();
  // Reading the list also loads it if needed, so a deep link straight to the form still finds the height.
  const { data } = useCheckins();
  const latestHeight = getLatestCheckin(data)?.heightCm;

  // Computed once: the form must not reset itself when the list refreshes underneath the user.
  const [defaultValues] = useState(() => getCreateDefaults(getLatestCheckin(data)));

  return (
    <FormBody
      title="New check-in"
      defaultValues={defaultValues}
      lateHeightCm={latestHeight === undefined ? undefined : String(latestHeight)}
      submit={mutate}
      isSubmitting={isSubmitting}
      error={error}
      clearError={reset}
    />
  );
}

function EditForm({ id }: { id: string }) {
  const router = useRouter();
  const { data: checkin, status, error: loadError, refetch } = useCheckin(id);
  const { mutate, isSubmitting, error, reset } = useUpdateCheckin(id);

  if (status === 'notFound') {
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState
          icon="document-outline"
          title="Check-in not found"
          message="It may have been deleted."
          actionLabel="Back to Check-ins"
          onAction={() => router.replace('/checkins')}
        />
      </Screen>
    );
  }
  if (!checkin) {
    return (
      <Screen edges={['left', 'right']}>
        {status === 'error' ? (
          <ErrorState message={loadError ?? 'Could not load this check-in.'} onRetry={() => void refetch()} />
        ) : (
          <LoadingState message="Loading check-in…" />
        )}
      </Screen>
    );
  }

  // `key` is not needed: the form only mounts once the check-in is there, and starts from this copy.
  return (
    <FormBody
      title="Edit check-in"
      defaultValues={checkinToFormValues(checkin)}
      submit={mutate}
      isSubmitting={isSubmitting}
      error={error}
      clearError={reset}
    />
  );
}

interface FormBodyProps {
  title: string;
  defaultValues: Partial<CheckinFormValues>;
  /** In create mode the list may arrive after the form opened. Used only if height is still empty. */
  lateHeightCm?: string;
  submit: (fields: CheckinFields) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

function FormBody({ title, defaultValues, lateHeightCm, submit, isSubmitting, error, clearError }: FormBodyProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const { control, handleSubmit, getValues, setValue } = useForm<CheckinFormValues, unknown, CheckinFormData>({
    resolver: zodResolver(checkinFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (lateHeightCm && !getValues('heightCm')) setValue('heightCm', lateHeightCm);
  }, [lateHeightCm, getValues, setValue]);

  // On failure the form stays as it is (the user's input is kept) and `error` shows in the banner.
  const save = handleSubmit(
    useCallback(
      async (data: CheckinFormData) => {
        if (await submit(data)) router.back();
      },
      [submit, router],
    ),
  );
  const onSave = () => void save();

  const sleepText = useWatch({ control, name: 'sleepHours' });
  const sleepWarning = typeof sleepText === 'string' && sleepText.trim() !== '' ? getSleepWarning(Number(sleepText.replace(',', '.'))) : null;
  const notesLength = (useWatch({ control, name: 'notes' }) ?? '').length;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable
              onPress={onSave}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Save check-in"
              accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
              style={styles.headerButton}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.tint} />
              ) : (
                <Text variant="headline" color="tint">
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
        <Controller
          control={control}
          name="checkinDate"
          render={({ field, fieldState }) => {
            const parsed = parseISO(field.value);
            return (
              <DateField
                label="Date"
                value={isValid(parsed) ? parsed : undefined}
                displayValue={isValid(parsed) ? formatCheckinDate(field.value) : 'Choose a date'}
                maximumDate={new Date()}
                error={fieldState.error?.message}
                onChange={(date) => {
                  field.onChange(toDateString(date));
                  clearError();
                }}
              />
            );
          }}
        />

        {NUMBER_FIELDS.map(({ name, label, placeholder, keyboardType }) => (
          <View key={name} style={styles.fieldGroup}>
            <NumberField
              control={control}
              name={name}
              label={label}
              placeholder={placeholder}
              keyboardType={keyboardType}
              editable={!isSubmitting}
              onEdit={clearError}
            />
            {name === 'sleepHours' && sleepWarning ? (
              <Text variant="footnote" color="status.pending" accessibilityLiveRegion="polite" style={styles.hint}>
                {sleepWarning}
              </Text>
            ) : null}
          </View>
        ))}

        <Controller
          control={control}
          name="mood"
          render={({ field, fieldState }) => (
            <MoodPicker
              value={field.value}
              onChange={(mood) => {
                field.onChange(mood);
                clearError();
              }}
              error={fieldState.error?.message}
            />
          )}
        />

        <View style={styles.fieldGroup}>
          <Controller
            control={control}
            name="notes"
            render={({ field, fieldState }) => (
              <TextField
                label="Notes (optional)"
                placeholder="How did the day go?"
                multiline
                value={field.value ?? ''}
                onChangeText={(text) => {
                  field.onChange(text);
                  clearError();
                }}
                onBlur={field.onBlur}
                editable={!isSubmitting}
                error={fieldState.error?.message}
              />
            )}
          />
          <Text
            variant="caption"
            color={notesLength > LIMITS.notesLength ? 'destructive' : 'secondaryLabel'}
            accessibilityLabel={`${notesLength} of ${LIMITS.notesLength} characters`}
            style={styles.counter}
          >
            {notesLength}/{LIMITS.notesLength}
          </Text>
        </View>

        {error ? <ErrorBanner message={error} onRetry={onSave} /> : null}

        <Button title="Save check-in" onPress={onSave} loading={isSubmitting} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

interface NumberFieldProps {
  control: FormControl;
  name: NumberFieldName;
  label: string;
  placeholder: string;
  keyboardType: KeyboardTypeOptions;
  editable: boolean;
  onEdit: () => void;
}

function NumberField({ control, name, label, placeholder, keyboardType, editable, onEdit }: NumberFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          placeholder={placeholder}
          keyboardType={keyboardType}
          value={field.value}
          onChangeText={(text) => {
            field.onChange(text);
            onEdit();
          }}
          onBlur={field.onBlur}
          editable={editable}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.md, paddingTop: spacing.md },
  fieldGroup: { gap: spacing.xs },
  hint: { paddingHorizontal: spacing.xs },
  counter: { textAlign: 'right', paddingHorizontal: spacing.xs },
  headerButton: {
    minWidth: layout.minHitTarget,
    minHeight: layout.minHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
