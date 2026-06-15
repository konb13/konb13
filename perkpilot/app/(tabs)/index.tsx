import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getClient } from '@/data';
import type { ValueAtRiskItem, ValueAtRiskSummary } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Badge, Loading, Empty } from '@/ui/components';
import { colors, space, urgencyColor } from '@/ui/theme';

export default function Dashboard() {
  const { data, loading } = useAsync<ValueAtRiskSummary>(() => getClient().getValueAtRisk());

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const summary = data ?? { total_at_risk_usd: 0, items: [] };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.label}>VALUE AT RISK · HOUSEHOLD</Text>
        <Text style={styles.amount}>${summary.total_at_risk_usd.toLocaleString()}</Text>
        <Body dim>Credits, certs, and points you'll lose if you do nothing.</Body>
      </View>

      <FlatList
        data={summary.items}
        keyExtractor={(i) => i.kind + i.id}
        contentContainerStyle={{ padding: space(4) }}
        ListEmptyComponent={<Empty message="Nothing at risk right now. Nicely done." />}
        renderItem={({ item }) => <RiskRow item={item} />}
      />
    </Screen>
  );
}

function RiskRow({ item }: { item: ValueAtRiskItem }) {
  const color = urgencyColor(item.urgency);
  const days = item.days_left;
  const dueLabel =
    days === null ? 'No date' : days <= 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`;

  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1, paddingRight: space(3) }}>
          <Text style={styles.title}>{item.title}</Text>
          <Body dim>{item.subtitle}</Body>
        </View>
        <View style={{ alignItems: 'flex-end', gap: space(2) }}>
          {item.est_value_usd > 0 && (
            <Text style={styles.value}>${item.est_value_usd.toLocaleString()}</Text>
          )}
          <Badge label={dueLabel} color={color} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { padding: space(5), paddingBottom: space(2) },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  amount: { color: colors.text, fontSize: 40, fontWeight: '800', marginVertical: space(1) },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: space(1) },
  value: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
