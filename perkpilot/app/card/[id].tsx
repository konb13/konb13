import { useCallback } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClient } from '@/data';
import type { Benefit, CardCatalogEntry, UserCard } from '@/data';
import { daysUntil } from '@/data/valueAtRisk';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Section, Row, Pill, Loading } from '@/ui/components';
import { issuerAccent, radius, space, typography, urgencyColor, useTheme } from '@/ui/theme';

interface CardDetail {
  card: UserCard | null;
  catalog: CardCatalogEntry | undefined;
  benefits: Benefit[];
}

export default function CardDetailScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, reload } = useAsync<CardDetail>(async () => {
    const client = getClient();
    const [cards, catalog, benefits] = await Promise.all([
      client.listUserCards(),
      client.getCatalog(),
      client.listBenefits(id),
    ]);
    const card = cards.find((c) => c.id === id) ?? null;
    return { card, catalog: catalog.find((c) => c.id === card?.catalog_id), benefits };
  }, [id]);

  const toggleUsed = useCallback(
    async (benefit: Benefit) => {
      await getClient().setBenefitUsed(benefit.id, !benefit.used);
      reload();
    },
    [reload],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { card, catalog, benefits } = data ?? { card: null, catalog: undefined, benefits: [] };
  const [accent, accentDark] = issuerAccent(catalog?.issuer ?? '');
  const title = card?.nickname ?? catalog?.product_name ?? 'Card';
  const remaining = benefits.filter((b) => !b.used).reduce((s, b) => s + b.est_value_usd, 0);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: catalog?.product_name ?? 'Card' }} />

      <View style={[styles.hero, { backgroundColor: accent, shadowColor: accentDark }]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroIssuer}>{catalog?.issuer?.toUpperCase()}</Text>
          <Ionicons name="card" size={26} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.heroName}>{title}</Text>
        <View style={styles.heroBottom}>
          <Text style={styles.heroMeta}>
            {catalog?.annual_fee ? `$${catalog.annual_fee}/yr` : 'No annual fee'}
            {card?.last4 ? `  ••${card.last4}` : ''}
          </Text>
          <Text style={styles.heroMeta}>${remaining.toLocaleString()} left</Text>
        </View>
      </View>

      <Section
        header="Benefits"
        footer={catalog ? `Benefits last verified ${catalog.last_verified_at}.` : undefined}
      >
        {benefits.length === 0 ? (
          <Row title="No benefits tracked" subtitle="This card has no recurring perks in the catalog." />
        ) : (
          benefits.map((b) => <BenefitRow key={b.id} benefit={b} onToggle={() => toggleUsed(b)} />)
        )}
      </Section>

      {card?.annual_fee_due_date ? (
        <Section header="Annual fee">
          <Row icon="calendar" iconBg={c.amber} title="Fee due" value={card.annual_fee_due_date} />
        </Section>
      ) : null}
    </Screen>
  );
}

function BenefitRow({ benefit, onToggle }: { benefit: Benefit; onToggle: () => void }) {
  const { c } = useTheme();
  const days = daysUntil(benefit.expiration_date);
  const urgency = days === null ? 'green' : days <= 7 ? 'red' : days <= 30 ? 'amber' : 'green';

  const subtitleParts: string[] = [];
  if (benefit.est_value_usd > 0) subtitleParts.push(`$${benefit.est_value_usd}`);
  if (benefit.expiration_date && !benefit.used) subtitleParts.push(`exp ${benefit.expiration_date}`);

  return (
    <Row
      title={benefit.used ? `✓ ${benefit.name}` : benefit.name}
      subtitle={subtitleParts.join('  ·  ') || undefined}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          {!benefit.used && benefit.expiration_date ? (
            <Pill label={days !== null && days <= 0 ? 'Expired' : `${days}d`} color={urgencyColor(urgency, c)} />
          ) : null}
          <Switch
            value={benefit.used}
            onValueChange={onToggle}
            trackColor={{ true: c.green, false: c.fill }}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    margin: space(4),
    borderRadius: radius.xl,
    padding: space(5),
    height: 180,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroIssuer: { ...typography.footnote, color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 1 },
  heroName: { ...typography.title, color: '#fff', fontWeight: '700' },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroMeta: { ...typography.subhead, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
});
