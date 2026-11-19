import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { resolveColor } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { ColorToken, TypographyVariant } from '../../types/ui';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
}

export function Text({ variant = 'body', color = 'label', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[typography[variant], { color: resolveColor(colors, color) }, style]} />;
}
