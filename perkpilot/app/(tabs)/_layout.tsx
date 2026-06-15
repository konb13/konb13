import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/ui/theme';

const icon = (emoji: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 20, color }}>{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'At Risk', tabBarIcon: icon('⚠️') }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: icon('💳') }} />
      <Tabs.Screen name="points" options={{ title: 'Points', tabBarIcon: icon('✦') }} />
      <Tabs.Screen name="household" options={{ title: 'Household', tabBarIcon: icon('🏠') }} />
    </Tabs>
  );
}
