import { router } from 'expo-router';
import { getClient, USE_MOCK_DATA } from '@/data';
import type { Household, User } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, LargeTitle, Section, Row, Loading } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface HouseholdView {
  household: Household | null;
  members: User[];
}

export default function HouseholdScreen() {
  const { c } = useTheme();
  const { data, loading } = useAsync<HouseholdView>(async () => {
    const client = getClient();
    const [household, members] = await Promise.all([client.getHousehold(), client.getMembers()]);
    return { household, members };
  });

  const onSignOut = async () => {
    await getClient().signOut();
    router.replace('/sign-in');
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { household, members } = data ?? { household: null, members: [] };

  return (
    <Screen scroll>
      <LargeTitle subtitle="One shared dataset, per-person ownership.">
        {household?.name ?? 'Household'}
      </LargeTitle>

      <Section header="Members" footer={`${members.length} ${members.length === 1 ? 'person' : 'people'} sharing this household.`}>
        {members.map((m) => (
          <Row
            key={m.id}
            icon="person-circle"
            iconBg={m.role === 'owner' ? c.accent : c.textTertiary}
            title={m.display_name}
            subtitle={m.email}
            value={m.role === 'owner' ? 'Owner' : 'Member'}
          />
        ))}
      </Section>

      <Section header="Manage">
        <Row icon="person-add" iconBg={c.green} title="Invite a member" chevron onPress={() => {}} />
        <Row icon="notifications" iconBg={c.red} title="Reminder settings" chevron onPress={() => {}} />
      </Section>

      <Section footer={USE_MOCK_DATA ? 'Demo data · set EXPO_PUBLIC_USE_MOCK_DATA=false to go live.' : undefined}>
        <Row icon="log-out" iconBg={c.textTertiary} title="Sign out" destructive onPress={onSignOut} />
      </Section>
    </Screen>
  );
}
