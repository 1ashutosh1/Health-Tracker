import type { TextStyle } from 'react-native';

import type { TypographyVariant } from '../types/ui';

// Keys match the names registered with useFonts in src/app/_layout.tsx.
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography: Record<TypographyVariant, TextStyle> = {
  largeTitle: { fontFamily: fontFamily.bold, fontSize: 34, lineHeight: 41 },
  title2: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28 },
  headline: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 22 },
  callout: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 21 },
  subhead: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 20 },
  // Card header labels ("Weight") use subhead size at semibold.
  subheadSemibold: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  metricValue: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
};
