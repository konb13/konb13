import { useEffect } from 'react';
import { router } from 'expo-router';
import { getClient } from '@/data';
import { Screen, Loading } from '@/ui/components';

export default function Index() {
  useEffect(() => {
    getClient()
      .getSession()
      .then((session) => router.replace(session ? '/(tabs)' : '/sign-in'))
      .catch(() => router.replace('/sign-in'));
  }, []);

  return (
    <Screen>
      <Loading />
    </Screen>
  );
}
