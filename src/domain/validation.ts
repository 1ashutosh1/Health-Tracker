import { isValid, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';

import { MOODS } from '../types/checkin';

/** Single source of truth for the limits, so the schema, the messages and the tests agree. */
export const LIMITS = {
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 50, max: 272 },
  sleepHours: { min: 0, max: 24 },
  steps: { max: 100_000 },
  waterLitres: { max: 10 },
  notesLength: 500,
  passwordLength: 6,
} as const;

// Plain decimals only: "72", "72.5", ".5", "-3". Rejects "abc", "1e3", "0x10", "Infinity".
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/;

// Some Android keyboards type "72,5" in decimal-pad inputs.
const withDotDecimal = (value: string) => value.replace(',', '.');

// Finite check catches digit strings so long they overflow to Infinity.
const isNumeric = (value: string) =>
  DECIMAL.test(withDotDecimal(value)) && Number.isFinite(Number(withDotDecimal(value)));

/** Turns a numeric string into a number. "-0" becomes 0 so we never store negative zero. */
const toNumber = (value: string) => {
  const n = Number(withDotDecimal(value));
  return n === 0 ? 0 : n;
};

/**
 * A text input holding a number. Stage one checks the string ("is it there, is it a number"),
 * stage two (`rules`) checks the number. If stage one fails, stage two never runs,
 * so the user sees one clear message per field.
 */
const numberInput = <T extends z.ZodNumber>(label: string, rules: (n: z.ZodNumber) => T) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => v === '' || isNumeric(v), 'Enter a valid number')
    .transform(toNumber)
    .pipe(rules(z.number()));

/** A check-in counts as "in the future" only if its calendar day is after today (local time). */
const isAfterToday = (date: Date) => startOfDay(date).getTime() > startOfDay(new Date()).getTime();

const { weightKg, heightCm, sleepHours, steps, waterLitres } = LIMITS;

export const checkinFormSchema = z.object({
  weightKg: numberInput('Weight', (n) =>
    n
      .min(weightKg.min, `Weight must be between ${weightKg.min} and ${weightKg.max} kg`)
      .max(weightKg.max, `Weight must be between ${weightKg.min} and ${weightKg.max} kg`),
  ),
  heightCm: numberInput('Height', (n) =>
    n
      .min(heightCm.min, `Height must be between ${heightCm.min} and ${heightCm.max} cm`)
      .max(heightCm.max, `Height must be between ${heightCm.min} and ${heightCm.max} cm`),
  ),
  sleepHours: numberInput('Sleep', (n) =>
    n
      .min(sleepHours.min, `Sleep must be between ${sleepHours.min} and ${sleepHours.max} hours`)
      .max(sleepHours.max, `Sleep must be between ${sleepHours.min} and ${sleepHours.max} hours`),
  ),
  steps: numberInput('Steps', (n) =>
    n
      .int('Steps must be a whole number')
      .min(0, 'Steps cannot be negative')
      .max(steps.max, `Steps must be ${steps.max.toLocaleString('en-US')} or fewer`),
  ),
  waterLitres: numberInput('Water', (n) =>
    n
      .gt(0, `Water must be more than 0 and at most ${waterLitres.max} litres`)
      .max(waterLitres.max, `Water must be more than 0 and at most ${waterLitres.max} litres`),
  ),
  mood: z.enum(MOODS, { error: 'Select how you feel' }),
  notes: z
    .string()
    .trim()
    .max(LIMITS.notesLength, `Notes must be ${LIMITS.notesLength} characters or fewer`)
    .optional()
    // An empty notes box means "no notes".
    .transform((v) => v || undefined),
  checkinDate: z
    .string({ error: 'Date is required' })
    .trim()
    .min(1, 'Date is required')
    .refine((v) => v === '' || isValid(parseISO(v)), 'Enter a valid date')
    .refine((v) => !isValid(parseISO(v)) || !isAfterToday(parseISO(v)), 'Date cannot be in the future'),
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email address')),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .min(LIMITS.passwordLength, `Password must be at least ${LIMITS.passwordLength} characters`),
});

/** What the inputs hold: every field is a string. Use as the form's value type. */
export type CheckinFormValues = z.input<typeof checkinFormSchema>;
/** What a valid submit produces: real numbers, notes trimmed or undefined. */
export type CheckinFormData = z.output<typeof checkinFormSchema>;
export type LoginValues = z.input<typeof loginSchema>;
