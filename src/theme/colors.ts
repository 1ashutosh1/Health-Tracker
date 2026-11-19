import type { ColorToken, Palette } from '../types/ui';

// Category, status and trend colors are the same in light and dark mode.
const category = {
  body: '#AF52DE', // weight, BMI
  activity: '#FF6B00', // steps
  sleep: '#5E5CE6',
  water: '#32ADE6',
  mind: '#30B0C7', // mood
} as const;

const status = {
  pending: '#FF9F0A',
  failed: '#FF3B30',
  synced: '#34C759',
} as const;

const trend = {
  down: '#34C759',
  up: '#FF9F0A',
} as const;

export const lightColors: Palette = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#6C6C70',
  tertiaryLabel: '#C7C7CC',
  separator: '#C6C6C8',
  fill: '#E9E9EB',
  segmentThumb: '#FFFFFF',
  tint: '#007AFF',
  destructive: '#FF3B30',
  heart: '#FF2D55',
  category,
  status,
  trend,
};

export const darkColors: Palette = {
  background: '#000000',
  card: '#1C1C1E',
  cardElevated: '#2C2C2E',
  label: '#FFFFFF',
  secondaryLabel: '#8E8E93',
  tertiaryLabel: '#48484A',
  separator: '#38383A',
  fill: '#2C2C2E',
  // cardElevated equals fill in dark mode, so the thumb needs its own lighter token.
  segmentThumb: '#636366',
  tint: '#0A84FF',
  destructive: '#FF453A',
  heart: '#FF375F',
  category,
  status,
  trend,
};

/** Turns a token name like "category.body" into a color string for the given palette. */
export function resolveColor(palette: Palette, token: ColorToken): string {
  if (token.startsWith('category.')) {
    return palette.category[token.slice('category.'.length) as keyof Palette['category']];
  }
  if (token.startsWith('status.')) {
    return palette.status[token.slice('status.'.length) as keyof Palette['status']];
  }
  if (token.startsWith('trend.')) {
    return palette.trend[token.slice('trend.'.length) as keyof Palette['trend']];
  }
  return palette[token as keyof Omit<Palette, 'category' | 'status' | 'trend'>];
}

/** Adds an alpha channel to a #RRGGBB color, e.g. withAlpha('#FF9F0A', 0.15) -> '#FF9F0A26'. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha));
  const channel = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hex}${channel}`;
}
