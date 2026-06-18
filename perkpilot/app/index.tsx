import { useEffect } from 'react';
import { router } from 'expo-router';
import { getClient } from '@/data';
import { Screen, Loading } from '@/ui/components';

export default function Index() {
  useEffect(() => {
    (async () => {
      const client = getClient();
      try {
        const session = await client.getSession();
        if (!session) return router.replace('/sign-in');
        const user = await client.getCurrentUser();
        router.replace(user ? '/(tabs)' : '/onboarding');
      } catch {
        router.replace('/sign-in');
      }
    })();
  }, []);

  return (
    <Screen>
      <Loading />
    </Screen>
  );
}
