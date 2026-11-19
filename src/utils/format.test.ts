import { formatCheckinDate, formatDecimal, formatShortDate, formatSteps, toDateString } from './format';

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
