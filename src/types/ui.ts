import type { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export type CategoryName = 'body' | 'activity' | 'sleep' | 'water' | 'mind';
export type StatusName = 'pending' | 'failed' | 'synced';
export type TrendName = 'down' | 'up';

/** The flat design tokens (everything except the grouped category / status / trend colors). */
export interface SemanticColors {
  background: string;
  card: string;
  cardElevated: string;
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  separator: string;
  /** Input and segmented-control track fill. */
  fill: string;
  /** Raised thumb of the segmented control. */
  segmentThumb: string;
  tint: string;
  destructive: string;
  heart: string;
}

export interface Palette extends SemanticColors {
  category: Record<CategoryName, string>;
  status: Record<StatusName, string>;
  trend: Record<TrendName, string>;
}

/** Anything a component can ask for by name: "label", "category.body", "status.failed", ... */
export type ColorToken =
  | keyof SemanticColors
  | `category.${CategoryName}`
  | `status.${StatusName}`
  | `trend.${TrendName}`;

export type TypographyVariant =
  | 'largeTitle'
  | 'title2'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'subheadSemibold'
  | 'footnote'
  | 'caption'
  | 'metricValue';
