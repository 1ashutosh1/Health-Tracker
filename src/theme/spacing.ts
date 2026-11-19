// 8pt grid. Use these instead of magic numbers.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  card: 14,
  control: 12, // buttons, text fields
  pill: 999,
} as const;

export const layout = {
  screenPadding: 16,
  controlHeight: 50,
  minHitTarget: 44,
} as const;
