import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon =
  (name: IoniconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  const { scheme, c } = useTheme();
  const ios = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarStyle: ios
          ? { position: 'absolute', borderTopColor: c.separator, backgroundColor: 'transparent' }
          : { backgroundColor: c.surface, borderTopColor: c.separator },
        tabBarBackground: ios
          ? () => <BlurView tint={scheme} intensity={80} style={{ flex: 1 }} />
          : undefined,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'At Risk', tabBarIcon: tabIcon('alert-circle') }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: tabIcon('card') }} />
      <Tabs.Screen name="points" options={{ title: 'Points', tabBarIcon: tabIcon('sparkles') }} />
      <Tabs.Screen name="household" options={{ title: 'Household', tabBarIcon: tabIcon('home') }} />
    </Tabs>
  );
}
