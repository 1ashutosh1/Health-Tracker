import { darkColors, lightColors, resolveColor, withAlpha } from './colors';

describe('withAlpha', () => {
  it('appends a two-digit hex alpha channel', () => {
    expect(withAlpha('#FF9F0A', 1)).toBe('#FF9F0AFF');
    expect(withAlpha('#FF9F0A', 0)).toBe('#FF9F0A00');
    expect(withAlpha('#FF9F0A', 0.15)).toBe('#FF9F0A26');
  });

  it('clamps out-of-range alpha', () => {
    expect(withAlpha('#000000', 2)).toBe('#000000FF');
    expect(withAlpha('#000000', -1)).toBe('#00000000');
  });
});

describe('resolveColor', () => {
  it('resolves flat tokens per palette', () => {
    expect(resolveColor(lightColors, 'background')).toBe('#F2F2F7');
    expect(resolveColor(darkColors, 'background')).toBe('#000000');
  });

  it('resolves grouped tokens', () => {
    expect(resolveColor(lightColors, 'category.body')).toBe('#AF52DE');
    expect(resolveColor(lightColors, 'status.failed')).toBe('#FF3B30');
    expect(resolveColor(darkColors, 'trend.down')).toBe('#34C759');
  });
});
