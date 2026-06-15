import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { colors } from '@/ui/theme';
import { registerForExpirationReminders } from '@/notifications';

export default function RootLayout() {
  useEffect(() => {
    // Phase 0 deliverable: local expiration reminders (30/7/1 day). No-op on web.
    registerForExpirationReminders().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-card" options={{ presentation: 'modal', title: 'Add a card' }} />
        <Stack.Screen name="card/[id]" options={{ title: 'Card' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
