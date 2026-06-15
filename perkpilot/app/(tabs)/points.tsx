import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getClient } from '@/data';
import type { PointsAccount, User } from '@/data';
import { PROGRAM_REFERENCE, programLabel } from '@/data/programReference';
import { daysUntil } from '@/data/valueAtRisk';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Badge, Loading, Empty } from '@/ui/components';
import { colors, space, urgencyColor } from '@/ui/theme';

interface PointsView {
  accounts: PointsAccount[];
  members: User[];
}

export default function Points() {
  const { data, loading } = useAsync<PointsView>(async () => {
    const client = getClient();
    const [accounts, members] = await Promise.all([
      client.listPointsAccounts(),
      client.getMembers(),
    ]);
    return { accounts, members };
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { accounts, members } = data ?? { accounts: [], members: [] };
  const memberName = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Member';

  return (
    <Screen>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: space(4) }}
        ListEmptyComponent={<Empty message="No loyalty accounts yet." />}
        renderItem={({ item }) => {
          const ref = PROGRAM_REFERENCE[item.program];
          const midValue = Math.round((item.balance * (ref?.cpp_mid ?? 1)) / 100);
          const deadline = item.hard_deadline ?? item.inactivity_deadline;
          const days = daysUntil(deadline);
          const urgency = days === null ? 'green' : days <= 30 ? 'red' : days <= 120 ? 'amber' : 'green';
          return (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.program}>{programLabel(item.program)}</Text>
                  <Body dim>{memberName(item.user_id)} · ~${midValue.toLocaleString()} value</Body>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space(2) }}>
                  <Text style={styles.balance}>{item.balance.toLocaleString()}</Text>
                  {deadline && (
                    <Badge
                      label={days !== null && days <= 0 ? 'Expired' : `${days}d`}
                      color={urgencyColor(urgency)}
                    />
                  )}
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  program: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: space(1) },
  balance: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
