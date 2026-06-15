import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getClient, USE_MOCK_DATA } from '@/data';
import type { Household, User } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Title, Body, Button, Loading } from '@/ui/components';
import { colors, space } from '@/ui/theme';

interface HouseholdView {
  household: Household | null;
  members: User[];
}

export default function HouseholdScreen() {
  const { data, loading } = useAsync<HouseholdView>(async () => {
    const client = getClient();
    const [household, members] = await Promise.all([
      client.getHousehold(),
      client.getMembers(),
    ]);
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
    <Screen>
      <View style={{ padding: space(4) }}>
        <Card>
          <Title>{household?.name ?? 'Household'}</Title>
          <Body dim>One shared dataset, per-person ownership.</Body>
        </Card>

        <Text style={styles.section}>MEMBERS</Text>
        {members.map((m) => (
          <Card key={m.id}>
            <View style={styles.memberRow}>
              <View>
                <Text style={styles.name}>{m.display_name}</Text>
                <Body dim>{m.email}</Body>
              </View>
              <Text style={[styles.role, m.role === 'owner' && { color: colors.primary }]}>
                {m.role}
              </Text>
            </View>
          </Card>
        ))}

        <View style={{ height: space(2) }} />
        <Button label="Invite a member" variant="ghost" onPress={() => {}} />
        <View style={{ height: space(3) }} />
        <Button label="Sign out" variant="ghost" onPress={onSignOut} />

        {USE_MOCK_DATA && (
          <Text style={styles.footer}>Demo data · flip EXPO_PUBLIC_USE_MOCK_DATA to go live</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginVertical: space(3) },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: space(1) },
  role: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  footer: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: space(6) },
});
