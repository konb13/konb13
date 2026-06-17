import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon =
  (name: IoniconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  const { c } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.separator },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'At Risk', tabBarIcon: tabIcon('alert-circle') }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: tabIcon('card') }} />
      <Tabs.Screen name="points" options={{ title: 'Points', tabBarIcon: tabIcon('sparkles') }} />
      <Tabs.Screen name="household" options={{ title: 'Household', tabBarIcon: tabIcon('home') }} />
    </Tabs>
  );
}
