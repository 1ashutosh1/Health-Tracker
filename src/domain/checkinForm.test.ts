import { makeCheckin } from '../test-utils/makeCheckin';
import { checkinToFormValues, getCreateDefaults, getLatestCheckin } from './checkinForm';
import { checkinFormSchema } from './validation';

describe('getLatestCheckin', () => {
  it('returns null for an empty list', () => {
    expect(getLatestCheckin([])).toBeNull();
  });

  it('picks the newest checkinDate regardless of array order', () => {
    const old = makeCheckin({ checkinDate: '2026-01-01' });
    const newest = makeCheckin({ checkinDate: '2026-03-01' });
    const middle = makeCheckin({ checkinDate: '2026-02-01' });
    expect(getLatestCheckin([middle, newest, old])).toBe(newest);
  });

  it('uses createdAt to break a same-day tie', () => {
    const morning = makeCheckin({ checkinDate: '2026-03-01', createdAt: '2026-03-01T07:00:00.000Z' });
    const evening = makeCheckin({ checkinDate: '2026-03-01', createdAt: '2026-03-01T20:00:00.000Z' });
    expect(getLatestCheckin([evening, morning])).toBe(evening);
  });
});

describe('getCreateDefaults', () => {
  const today = new Date(2026, 10, 19);

  it('prefills today and the height of the latest check-in', () => {
    const defaults = getCreateDefaults({ heightCm: 175.5 }, today);
    expect(defaults.heightCm).toBe('175.5');
    expect(defaults.checkinDate).toBe('2026-11-19');
  });

  it('leaves height empty when there is no previous check-in', () => {
    expect(getCreateDefaults(null, today).heightCm).toBe('');
  });

  it('leaves mood unset so the user must pick one', () => {
    expect(getCreateDefaults(null, today).mood).toBeUndefined();
  });
});

describe('checkinToFormValues', () => {
  it('converts every field to the string the input holds', () => {
    const values = checkinToFormValues(
      makeCheckin({ weightKg: 72.4, heightCm: 180, sleepHours: 7.5, steps: 8200, waterLitres: 2.5, notes: 'Felt good' }),
    );
    expect(values).toMatchObject({
      weightKg: '72.4',
      heightCm: '180',
      sleepHours: '7.5',
      steps: '8200',
      waterLitres: '2.5',
      notes: 'Felt good',
      mood: 'happy',
    });
  });

  it('uses an empty string for missing notes', () => {
    expect(checkinToFormValues(makeCheckin({ notes: undefined })).notes).toBe('');
  });

  it('reduces a full timestamp to its calendar day', () => {
    expect(checkinToFormValues(makeCheckin({ checkinDate: '2026-02-03T10:30:00' })).checkinDate).toBe('2026-02-03');
  });

  it('produces values the form schema accepts (edit round trip)', () => {
    const original = makeCheckin({ weightKg: 72.4, notes: 'ok' });
    const parsed = checkinFormSchema.parse(checkinToFormValues(original));
    expect(parsed).toMatchObject({ weightKg: 72.4, heightCm: original.heightCm, notes: 'ok', mood: 'happy' });
  });
});
