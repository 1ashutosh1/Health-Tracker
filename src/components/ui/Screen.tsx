import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView. Use false for screens that own a FlatList. */
  scroll?: boolean;
  /** Which safe-area edges to pad. Screens under a native header or tab bar can drop some. */
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  contentStyle,
}: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fixedContent, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xl,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },
});
