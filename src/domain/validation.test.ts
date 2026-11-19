import { checkinFormSchema, loginSchema, type CheckinFormValues } from './validation';

// "Today" is fixed so the future-date rules are deterministic: Monday 15 June 2026, 12:00 local time.
beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 5, 15, 12, 0, 0) });
});
afterAll(() => {
  jest.useRealTimers();
});

const validValues: CheckinFormValues = {
  weightKg: '72.4',
  heightCm: '175',
  sleepHours: '7.5',
  steps: '8500',
  waterLitres: '2.5',
  mood: 'happy',
  notes: 'Felt good after a run',
  checkinDate: '2026-06-15',
};

/** Parses the valid form with some fields overridden. */
const parse = (overrides: Record<string, unknown> = {}) =>
  checkinFormSchema.safeParse({ ...validValues, ...overrides });

/** The first error message for a field, or undefined when the field is valid. */
function errorFor(field: string, value: unknown): string | undefined {
  const result = parse({ [field]: value });
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('checkinFormSchema: happy path', () => {
  it('accepts valid values and coerces the strings to numbers', () => {
    const result = parse();
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      weightKg: 72.4,
      heightCm: 175,
      sleepHours: 7.5,
      steps: 8500,
      waterLitres: 2.5,
      mood: 'happy',
      notes: 'Felt good after a run',
      checkinDate: '2026-06-15',
    });
  });

  it('only produces errors for the fields that are wrong', () => {
    const result = parse({ weightKg: '5', steps: '-1' });
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(new Set(fields)).toEqual(new Set(['weightKg', 'steps']));
  });

  it('reports every required field when the form is empty', () => {
    const result = checkinFormSchema.safeParse({});
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(new Set(fields)).toEqual(
      new Set(['weightKg', 'heightCm', 'sleepHours', 'steps', 'waterLitres', 'mood', 'checkinDate']),
    );
  });
});

describe('number inputs: shared behaviour', () => {
  const numericFields = [
    ['weightKg', 'Weight'],
    ['heightCm', 'Height'],
    ['sleepHours', 'Sleep'],
    ['steps', 'Steps'],
    ['waterLitres', 'Water'],
  ] as const;

  it.each(numericFields)('%s: empty string says it is required', (field, label) => {
    expect(errorFor(field, '')).toBe(`${label} is required`);
  });

  it.each(numericFields)('%s: whitespace only says it is required', (field, label) => {
    expect(errorFor(field, '   ')).toBe(`${label} is required`);
  });

  it.each(numericFields)('%s: a missing value says it is required', (field, label) => {
    const { [field]: _omitted, ...rest } = validValues;
    const result = checkinFormSchema.safeParse(rest);
    expect(result.error?.issues.find((i) => i.path[0] === field)?.message).toBe(`${label} is required`);
  });

  it.each(numericFields)('%s: "abc" is not a valid number', (field) => {
    expect(errorFor(field, 'abc')).toBe('Enter a valid number');
  });

  it.each(['1e3', '0x10', 'Infinity', 'NaN', '1.2.3', '--5', '5kg', '1 000'])(
    'rejects "%s" as a number',
    (value) => {
      expect(errorFor('weightKg', value)).toBe('Enter a valid number');
    },
  );

  it('reports only one message for a bad number (no cascade into the range check)', () => {
    const result = parse({ weightKg: 'abc' });
    expect(result.error?.issues.filter((i) => i.path[0] === 'weightKg')).toHaveLength(1);
  });

  it('trims surrounding whitespace', () => {
    expect(parse({ weightKg: '  72.4 ' }).data?.weightKg).toBe(72.4);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parse({ weightKg: '72,5' }).data?.weightKg).toBe(72.5);
  });

  it('accepts ".5" and "72." style input', () => {
    expect(parse({ waterLitres: '.5' }).data?.waterLitres).toBe(0.5);
    expect(parse({ weightKg: '72.' }).data?.weightKg).toBe(72);
  });
});

describe('weight (20-400 kg)', () => {
  const message = 'Weight must be between 20 and 400 kg';

  it.each(['20', '20.0', '400', '72.4'])('accepts %s', (value) => {
    expect(errorFor('weightKg', value)).toBeUndefined();
  });

  it.each(['19.9', '0', '-5', '400.1', '1000'])('rejects %s', (value) => {
    expect(errorFor('weightKg', value)).toBe(message);
  });
});

describe('height (50-272 cm)', () => {
  const message = 'Height must be between 50 and 272 cm';

  it.each(['50', '272', '175.5'])('accepts %s', (value) => {
    expect(errorFor('heightCm', value)).toBeUndefined();
  });

  it.each(['49.9', '0', '272.1', '-170'])('rejects %s', (value) => {
    expect(errorFor('heightCm', value)).toBe(message);
  });
});

describe('sleep (0-24 hours)', () => {
  const message = 'Sleep must be between 0 and 24 hours';

  it.each(['0', '24', '7.5'])('accepts %s', (value) => {
    expect(errorFor('sleepHours', value)).toBeUndefined();
  });

  it.each(['-0.5', '24.1', '25'])('rejects %s', (value) => {
    expect(errorFor('sleepHours', value)).toBe(message);
  });

  it('does not reject unusual-but-possible sleep (3h warning range is a UI concern)', () => {
    expect(errorFor('sleepHours', '1')).toBeUndefined();
    expect(errorFor('sleepHours', '16')).toBeUndefined();
  });
});

describe('steps (whole number, 0-100,000)', () => {
  it.each(['0', '1', '8500', '100000'])('accepts %s', (value) => {
    expect(errorFor('steps', value)).toBeUndefined();
  });

  it('rejects negative steps', () => {
    expect(errorFor('steps', '-1')).toBe('Steps cannot be negative');
    expect(errorFor('steps', '-5000')).toBe('Steps cannot be negative');
  });

  it('rejects decimal steps', () => {
    expect(errorFor('steps', '5000.5')).toBe('Steps must be a whole number');
    expect(errorFor('steps', '0.1')).toBe('Steps must be a whole number');
  });

  it('rejects more than 100,000 steps', () => {
    expect(errorFor('steps', '100001')).toBe('Steps must be 100,000 or fewer');
  });

  it('accepts "5000.0" because it is a whole number', () => {
    expect(parse({ steps: '5000.0' }).data?.steps).toBe(5000);
  });

  it('turns "-0" into 0, not negative zero', () => {
    const steps = parse({ steps: '-0' }).data?.steps;
    expect(Object.is(steps, 0)).toBe(true);
  });
});

describe('water (more than 0, at most 10 litres)', () => {
  const message = 'Water must be more than 0 and at most 10 litres';

  it.each(['0.1', '2.5', '10'])('accepts %s', (value) => {
    expect(errorFor('waterLitres', value)).toBeUndefined();
  });

  it.each(['0', '0.0', '-1', '10.1', '50'])('rejects %s', (value) => {
    expect(errorFor('waterLitres', value)).toBe(message);
  });
});

describe('mood', () => {
  it.each(['happy', 'neutral', 'sad'])('accepts %s', (mood) => {
    expect(errorFor('mood', mood)).toBeUndefined();
  });

  it.each([['empty string', ''], ['unknown value', 'angry'], ['wrong case', 'Happy'], ['undefined', undefined]])(
    'rejects %s',
    (_name, value) => {
      expect(errorFor('mood', value)).toBe('Select how you feel');
    },
  );
});

describe('notes (optional, max 500)', () => {
  it('is optional: missing, empty and whitespace all become undefined', () => {
    const { notes: _omitted, ...withoutNotes } = validValues;
    expect(checkinFormSchema.safeParse(withoutNotes).data?.notes).toBeUndefined();
    expect(parse({ notes: '' }).data?.notes).toBeUndefined();
    expect(parse({ notes: '   ' }).data?.notes).toBeUndefined();
  });

  it('trims the text', () => {
    expect(parse({ notes: '  slept badly  ' }).data?.notes).toBe('slept badly');
  });

  it('accepts exactly 500 characters', () => {
    expect(errorFor('notes', 'a'.repeat(500))).toBeUndefined();
  });

  it('rejects 501 characters', () => {
    expect(errorFor('notes', 'a'.repeat(501))).toBe('Notes must be 500 characters or fewer');
  });
});

describe('checkinDate (valid, not in the future)', () => {
  it('accepts today', () => {
    expect(errorFor('checkinDate', '2026-06-15')).toBeUndefined();
  });

  it('accepts a past date', () => {
    expect(errorFor('checkinDate', '2026-01-01')).toBeUndefined();
    expect(errorFor('checkinDate', '2026-06-14')).toBeUndefined();
  });

  it('accepts a full ISO timestamp from earlier today', () => {
    expect(errorFor('checkinDate', '2026-06-15T08:30:00')).toBeUndefined();
  });

  it('accepts a later time today (the rule is by calendar day)', () => {
    expect(errorFor('checkinDate', '2026-06-15T23:59:00')).toBeUndefined();
  });

  it('rejects tomorrow', () => {
    expect(errorFor('checkinDate', '2026-06-16')).toBe('Date cannot be in the future');
  });

  it('rejects a date far in the future', () => {
    expect(errorFor('checkinDate', '2030-01-01')).toBe('Date cannot be in the future');
  });

  it('rejects a timestamp on a future day', () => {
    expect(errorFor('checkinDate', '2026-06-16T00:00:01')).toBe('Date cannot be in the future');
  });

  it('rejects an empty string as required', () => {
    expect(errorFor('checkinDate', '')).toBe('Date is required');
  });

  it('rejects a missing date as required', () => {
    const { checkinDate: _omitted, ...rest } = validValues;
    const result = checkinFormSchema.safeParse(rest);
    expect(result.error?.issues[0].message).toBe('Date is required');
  });

  it.each(['abc', '15/06/2026', '2026-13-01', '2026-02-30', '2026-6'])('rejects "%s" as an invalid date', (value) => {
    expect(errorFor('checkinDate', value)).toBe('Enter a valid date');
  });

  it('gives one message for an invalid date (not also "future")', () => {
    const result = parse({ checkinDate: 'abc' });
    expect(result.error?.issues.filter((i) => i.path[0] === 'checkinDate')).toHaveLength(1);
  });
});

describe('loginSchema', () => {
  const loginError = (field: string, value: unknown, other: Record<string, unknown> = {}) => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'secret1', ...other, [field]: value });
    return result.error?.issues.find((i) => i.path[0] === field)?.message;
  };

  it('accepts a valid email and password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'secret1' }).success).toBe(true);
  });

  it('trims the email', () => {
    const result = loginSchema.safeParse({ email: '  user@example.com ', password: 'secret1' });
    expect(result.data?.email).toBe('user@example.com');
  });

  it('requires an email', () => {
    expect(loginError('email', '')).toBe('Email is required');
    expect(loginError('email', '   ')).toBe('Email is required');
    expect(loginError('email', undefined)).toBe('Email is required');
  });

  it.each(['plainaddress', 'missing@tld', '@no-local.com', 'two@@example.com', 'spaces in@example.com'])(
    'rejects the invalid email "%s"',
    (email) => {
      expect(loginError('email', email)).toBe('Enter a valid email address');
    },
  );

  it('requires a password', () => {
    expect(loginError('password', '')).toBe('Password is required');
    expect(loginError('password', undefined)).toBe('Password is required');
  });

  it('rejects a password shorter than 6 characters', () => {
    expect(loginError('password', '12345')).toBe('Password must be at least 6 characters');
  });

  it('accepts a password of exactly 6 characters', () => {
    expect(loginError('password', '123456')).toBeUndefined();
  });

  it('does not trim the password (spaces count)', () => {
    expect(loginError('password', '      ')).toBeUndefined();
  });
});
