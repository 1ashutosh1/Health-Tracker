import { useColorScheme } from 'react-native';

import type { Palette } from '../types/ui';
import { darkColors, lightColors } from './colors';

export interface Theme {
  colors: Palette;
  isDark: boolean;
}

const lightTheme: Theme = { colors: lightColors, isDark: false };
const darkTheme: Theme = { colors: darkColors, isDark: true };

/** Follows the system appearance. Returns stable objects so memoized children don't re-render. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
