import { StyleSheet, Text, View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import { getClient } from '@/data';
import type { ValueAtRiskItem, ValueAtRiskSummary } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, LargeTitle, Card, Section, Row, Pill, Loading, EmptyState } from '@/ui/components';
import { space, typography, urgencyColor, useTheme } from '@/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICON: Record<string, IconName> = {
  points: 'sparkles',
};

export default function Dashboard() {
  const { c } = useTheme();
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
    <Screen scroll>
      <LargeTitle>At Risk</LargeTitle>

      <Card style={{ paddingVertical: space(5) }}>
        <Text style={[typography.footnote, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          Household value at risk
        </Text>
        <Text style={[styles.total, { color: c.text }]}>${summary.total_at_risk_usd.toLocaleString()}</Text>
        <Text style={[typography.subhead, { color: c.textSecondary }]}>
          Credits, certificates, and points you'll lose if you do nothing.
        </Text>
      </Card>

      {summary.items.length === 0 ? (
        <View style={{ marginTop: space(16) }}>
          <EmptyState icon="checkmark-circle" title="Nothing at risk" message="You're all caught up. Nicely done." />
        </View>
      ) : (
        <Section header="Expiring soon">
          {summary.items.map((item) => (
            <RiskRow key={item.kind + item.id} item={item} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function RiskRow({ item }: { item: ValueAtRiskItem }) {
  const { c } = useTheme();
  const color = urgencyColor(item.urgency, c);
  const days = item.days_left;
  const label = days === null ? 'No date' : days <= 0 ? 'Today' : `${days}d`;
  const icon: IconName = item.kind === 'points' ? ICON.points : 'pricetags';

  return (
    <Row
      icon={icon}
      iconBg={color}
      title={item.title}
      subtitle={item.subtitle}
      value={item.est_value_usd > 0 ? `$${item.est_value_usd.toLocaleString()}` : undefined}
      valueColor={c.text}
      trailing={<View style={{ marginLeft: space(2) }}><Pill label={label} color={color} /></View>}
    />
  );
}

const styles = StyleSheet.create({
  total: { ...typography.largeTitle, fontSize: 44, marginVertical: space(1) },
});
