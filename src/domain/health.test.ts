import { makeCheckin } from '../test-utils/makeCheckin';
import { calculateBMI, compareCheckins, computeDashboardStats, getBMICategory, getSleepWarning } from './health';

describe('calculateBMI', () => {
  it('computes 70 kg at 175 cm as 22.9', () => {
    expect(calculateBMI(70, 175)).toBe(22.9);
  });

  it('rounds to one decimal place', () => {
    expect(calculateBMI(80, 180)).toBe(24.7); // 24.691...
    expect(calculateBMI(100, 170)).toBe(34.6); // 34.602...
  });

  it('works at the extremes of the allowed input ranges', () => {
    expect(calculateBMI(20, 272)).toBe(2.7);
    expect(calculateBMI(400, 50)).toBe(1600);
  });

  it.each([
    ['zero weight', 0, 175],
    ['zero height', 70, 0],
    ['negative weight', -70, 175],
    ['negative height', 70, -175],
    ['NaN weight', NaN, 175],
    ['NaN height', 70, NaN],
    ['Infinity weight', Infinity, 175],
    ['Infinity height', 70, Infinity],
  ])('returns null for %s', (_name, weight, height) => {
    expect(calculateBMI(weight, height)).toBeNull();
  });
});

describe('getBMICategory (WHO cut-offs)', () => {
  it.each([
    [10, 'Underweight'],
    [18.4, 'Underweight'],
    [18.5, 'Normal'],
    [22.9, 'Normal'],
    [24.9, 'Normal'],
    [25, 'Overweight'],
    [29.9, 'Overweight'],
    [30, 'Obese'],
    [45, 'Obese'],
  ])('BMI %s is %s', (bmi, expected) => {
    expect(getBMICategory(bmi)).toBe(expected);
  });
});

describe('compareCheckins', () => {
  it('orders by checkinDate, not createdAt', () => {
    const logged = makeCheckin({ checkinDate: '2026-03-01', createdAt: '2026-03-01T08:00:00.000Z' });
    const backfilled = makeCheckin({ checkinDate: '2026-01-01', createdAt: '2026-03-05T08:00:00.000Z' });
    expect([logged, backfilled].sort(compareCheckins)).toEqual([backfilled, logged]);
  });

  it('breaks same-day ties with createdAt', () => {
    const morning = makeCheckin({ checkinDate: '2026-02-01', createdAt: '2026-02-01T07:00:00.000Z' });
    const evening = makeCheckin({ checkinDate: '2026-02-01', createdAt: '2026-02-01T20:00:00.000Z' });
    expect([evening, morning].sort(compareCheckins)).toEqual([morning, evening]);
  });
});

describe('computeDashboardStats', () => {
  it('returns a clear empty shape for no check-ins', () => {
    expect(computeDashboardStats([])).toEqual({
      current: null,
      starting: null,
      difference: null,
      trend: null,
      bmi: null,
      bmiCategory: null,
      total: 0,
      latestDate: null,
      history: [],
    });
  });

  it('handles a single check-in: difference 0, trend "same"', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 70, heightCm: 175, checkinDate: '2026-02-10' }),
    ]);
    expect(stats).toEqual({
      current: 70,
      starting: 70,
      difference: 0,
      trend: 'same',
      bmi: 22.9,
      bmiCategory: 'Normal',
      total: 1,
      latestDate: '2026-02-10',
      history: [{ date: '2026-02-10', weightKg: 70 }],
    });
  });

  it('reports a weight loss as trend "down" with a negative difference', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 75.1, checkinDate: '2026-01-01' }),
      makeCheckin({ weightKg: 72.4, checkinDate: '2026-02-01' }),
    ]);
    expect(stats.starting).toBe(75.1);
    expect(stats.current).toBe(72.4);
    expect(stats.difference).toBe(-2.7); // not -2.7000000000000028
    expect(stats.trend).toBe('down');
  });

  it('reports a weight gain as trend "up"', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 70, checkinDate: '2026-01-01' }),
      makeCheckin({ weightKg: 71.5, checkinDate: '2026-02-01' }),
    ]);
    expect(stats.difference).toBe(1.5);
    expect(stats.trend).toBe('up');
  });

  it('reports "same" when the weight returns to the starting value', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 70, checkinDate: '2026-01-01' }),
      makeCheckin({ weightKg: 73, checkinDate: '2026-01-15' }),
      makeCheckin({ weightKg: 70, checkinDate: '2026-02-01' }),
    ]);
    expect(stats.difference).toBe(0);
    expect(stats.trend).toBe('same');
  });

  it('never returns negative zero for the difference', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 70.04, checkinDate: '2026-01-01' }),
      makeCheckin({ weightKg: 70, checkinDate: '2026-02-01' }),
    ]);
    expect(Object.is(stats.difference, 0)).toBe(true);
    expect(stats.trend).toBe('same');
  });

  it('sorts unsorted input by checkinDate, so current is the latest day, not the last in the array', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 72, checkinDate: '2026-03-01' }),
      makeCheckin({ weightKg: 75, checkinDate: '2026-01-01' }),
      makeCheckin({ weightKg: 74, checkinDate: '2026-02-01' }),
    ]);
    expect(stats.starting).toBe(75);
    expect(stats.current).toBe(72);
    expect(stats.latestDate).toBe('2026-03-01');
    expect(stats.history.map((p) => p.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(stats.total).toBe(3);
  });

  it('uses checkinDate rather than createdAt for ordering (back-filled entry)', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 70, checkinDate: '2026-02-01', createdAt: '2026-02-01T08:00:00.000Z' }),
      // Entered last, but measured earliest.
      makeCheckin({ weightKg: 80, checkinDate: '2026-01-01', createdAt: '2026-02-10T08:00:00.000Z' }),
    ]);
    expect(stats.starting).toBe(80);
    expect(stats.current).toBe(70);
  });

  it('breaks same-day ties with createdAt: the later entry is current', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 71, checkinDate: '2026-02-01', createdAt: '2026-02-01T20:00:00.000Z' }),
      makeCheckin({ weightKg: 72, checkinDate: '2026-02-01', createdAt: '2026-02-01T07:00:00.000Z' }),
    ]);
    expect(stats.starting).toBe(72);
    expect(stats.current).toBe(71);
    expect(stats.history).toHaveLength(2);
  });

  it('computes BMI from the latest check-in (weight and height)', () => {
    const stats = computeDashboardStats([
      makeCheckin({ weightKg: 90, heightCm: 170, checkinDate: '2026-01-01' }),
      makeCheckin({ weightKg: 70, heightCm: 175, checkinDate: '2026-02-01' }),
    ]);
    expect(stats.bmi).toBe(22.9);
    expect(stats.bmiCategory).toBe('Normal');
  });

  it('does not mutate the input array', () => {
    const input = [makeCheckin({ checkinDate: '2026-03-01' }), makeCheckin({ checkinDate: '2026-01-01' })];
    const before = [...input];
    computeDashboardStats(input);
    expect(input).toEqual(before);
  });
});

describe('getSleepWarning', () => {
  it('warns below 3 hours and above 14 hours', () => {
    expect(getSleepWarning(2.9)).toMatch(/very little/);
    expect(getSleepWarning(0)).toMatch(/very little/);
    expect(getSleepWarning(14.1)).toMatch(/a lot/);
    expect(getSleepWarning(24)).toMatch(/a lot/);
  });

  it('does not warn from 3 to 14 hours inclusive', () => {
    expect(getSleepWarning(3)).toBeNull();
    expect(getSleepWarning(8)).toBeNull();
    expect(getSleepWarning(14)).toBeNull();
  });

  it('does not warn for a non-number', () => {
    expect(getSleepWarning(NaN)).toBeNull();
  });
});
