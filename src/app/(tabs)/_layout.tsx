import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { fontFamily } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.secondaryLabel,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 10 },
        // Apple style: flat bar with a hairline on top, no shadow.
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Summary',
          tabBarAccessibilityLabel: 'Summary',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={size}
              color={focused ? colors.tint : colors.secondaryLabel}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="checkins"
        options={{
          title: 'Check-ins',
          tabBarAccessibilityLabel: 'Check-ins',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={size}
              color={focused ? colors.tint : colors.secondaryLabel}
            />
          ),
        }}
      />
    </Tabs>
  );
}
