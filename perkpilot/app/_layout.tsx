import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useTheme } from '@/ui/theme';
import { registerForExpirationReminders } from '@/notifications';

export default function RootLayout() {
  const { scheme, c } = useTheme();

  useEffect(() => {
    registerForExpirationReminders().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerShadowVisible: false,
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.text },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-card" options={{ presentation: 'modal', title: 'Add Card' }} />
        <Stack.Screen name="card/[id]" options={{ title: '' }} />
        <Stack.Screen name="fee-analysis" options={{ title: 'Fee Decisions' }} />
        <Stack.Screen name="two-player" options={{ title: 'Two-Player Plan' }} />
        <Stack.Screen name="estimator" options={{ title: 'Points Estimator' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
