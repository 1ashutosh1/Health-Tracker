import {
  formatCheckinDate,
  formatDecimal,
  formatRelativeDay,
  formatShortDate,
  formatShortIsoDate,
  formatSignedDecimal,
  formatSteps,
  toDateString,
} from './format';

describe('format', () => {
  it('formatDecimal keeps one decimal and drops a trailing .0', () => {
    expect(formatDecimal(72.4)).toBe('72.4');
    expect(formatDecimal(72)).toBe('72');
    expect(formatDecimal(72.46)).toBe('72.5');
    expect(formatDecimal(2.25, 2)).toBe('2.25');
  });

  it('formatSteps groups thousands', () => {
    expect(formatSteps(8200)).toBe('8,200');
    expect(formatSteps(0)).toBe('0');
    expect(formatSteps(100000)).toBe('100,000');
  });

  it('formatCheckinDate formats a date-only string in local time', () => {
    expect(formatCheckinDate('2026-11-19')).toBe('Thu, Nov 19, 2026');
  });

  it('formatCheckinDate formats a full ISO timestamp', () => {
    expect(formatCheckinDate('2026-11-19T12:00:00')).toBe('Thu, Nov 19, 2026');
  });

  it('formatCheckinDate never shows "Invalid Date"', () => {
    expect(formatCheckinDate('not a date')).toBe('not a date');
  });

  it('toDateString and formatShortDate use the local calendar day', () => {
    const date = new Date(2026, 10, 5);
    expect(toDateString(date)).toBe('2026-11-05');
    expect(formatShortDate(date)).toBe('Nov 5');
  });
});

describe('relative and signed formatting', () => {
  const now = new Date(2026, 10, 19, 15, 0); // Nov 19 2026, 3pm

  it('formatRelativeDay says Today, Yesterday and "N days ago"', () => {
    expect(formatRelativeDay('2026-11-19', now)).toBe('Today');
    expect(formatRelativeDay('2026-11-19T08:00:00', now)).toBe('Today');
    expect(formatRelativeDay('2026-11-18', now)).toBe('Yesterday');
    expect(formatRelativeDay('2026-11-16', now)).toBe('3 days ago');
    expect(formatRelativeDay('2026-11-13', now)).toBe('6 days ago');
  });

  it('formatRelativeDay switches to a plain date from a week on', () => {
    expect(formatRelativeDay('2026-11-12', now)).toBe('Nov 12');
    expect(formatRelativeDay('2025-12-30', now)).toBe('Dec 30, 2025');
  });

  it('formatRelativeDay treats a future date as Today and never shows "Invalid Date"', () => {
    expect(formatRelativeDay('2026-11-25', now)).toBe('Today');
    expect(formatRelativeDay('nope', now)).toBe('nope');
  });

  it('formatShortIsoDate omits the year only for the current year', () => {
    expect(formatShortIsoDate('2026-03-02', now)).toBe('Mar 2');
    expect(formatShortIsoDate('2025-03-02', now)).toBe('Mar 2, 2025');
    expect(formatShortIsoDate('bad', now)).toBe('bad');
  });

  it('formatSignedDecimal always shows the direction as text', () => {
    expect(formatSignedDecimal(1.2)).toBe('+1.2');
    expect(formatSignedDecimal(-3.6)).toBe('-3.6');
    expect(formatSignedDecimal(0)).toBe('0');
    expect(formatSignedDecimal(-0.04)).toBe('0'); // rounds to zero: no "-0"
  });
});
