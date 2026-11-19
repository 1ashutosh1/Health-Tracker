import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useNetworkMonitor } from '../hooks/useNetworkMonitor';
import { useAuthStore } from '../stores/authStore';
import { fontFamily } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

// A deep link straight to checkin/[id] still gets the tabs underneath it, so Back has somewhere to go.
export const unstable_settings = { initialRouteName: '(tabs)' };

// Keep the splash screen up until fonts and the saved session are ready, so neither the
// system font nor the login screen ever flashes.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  // Keeps networkStore in step with NetInfo for the whole life of the app.
  useNetworkMonitor();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = fontsReady && status !== 'hydrating';

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    // If font loading failed we still show the app (with system fonts) rather than hang on the splash.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerTintColor: colors.tint,
          headerTitleStyle: { fontFamily: fontFamily.semibold, color: colors.label },
          headerStyle: { backgroundColor: colors.card },
        }}
      >
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="checkin/new" options={{ presentation: 'modal', headerShown: true, title: 'New check-in' }} />
          <Stack.Screen name="checkin/[id]/index" options={{ headerShown: true, title: 'Check-in' }} />
          <Stack.Screen
            name="checkin/[id]/edit"
            options={{ presentation: 'modal', headerShown: true, title: 'Edit check-in' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
