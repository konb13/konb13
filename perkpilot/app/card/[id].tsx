import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getClient } from '@/data';
import type { Benefit, CardCatalogEntry, UserCard } from '@/data';
import { daysUntil } from '@/data/valueAtRisk';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Badge, Loading } from '@/ui/components';
import { colors, space, urgencyColor } from '@/ui/theme';

interface CardDetail {
  card: UserCard | null;
  catalog: CardCatalogEntry | undefined;
  benefits: Benefit[];
}

export default function CardDetailScreen() {
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
  const title = card?.nickname ?? `${catalog?.issuer ?? ''} ${catalog?.product_name ?? 'Card'}`;

  return (
    <Screen>
      <Stack.Screen options={{ title: catalog?.product_name ?? 'Card' }} />
      <FlatList
        data={benefits}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: space(4) }}
        ListHeaderComponent={
          <Card>
            <Text style={styles.title}>{title}</Text>
            <Body dim>
              {catalog?.annual_fee ? `$${catalog.annual_fee}/yr` : 'No annual fee'}
              {card?.annual_fee_due_date ? ` · fee due ${card.annual_fee_due_date}` : ''}
            </Body>
            {catalog && (
              <Text style={styles.verified}>
                Benefits last verified {catalog.last_verified_at}
              </Text>
            )}
          </Card>
        }
        renderItem={({ item }) => <BenefitRow benefit={item} onToggle={() => toggleUsed(item)} />}
      />
    </Screen>
  );
}

function BenefitRow({ benefit, onToggle }: { benefit: Benefit; onToggle: () => void }) {
  const days = daysUntil(benefit.expiration_date);
  const urgency = days === null ? 'green' : days <= 7 ? 'red' : days <= 30 ? 'amber' : 'green';

  return (
    <Pressable onPress={onToggle}>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: space(3) }}>
            <Text style={[styles.benefitName, benefit.used && styles.struck]}>{benefit.name}</Text>
            <View style={styles.metaRow}>
              {benefit.est_value_usd > 0 && (
                <Text style={styles.value}>${benefit.est_value_usd}</Text>
              )}
              {benefit.expiration_date && !benefit.used && (
                <Badge
                  label={days !== null && days <= 0 ? 'Expired' : `${days}d`}
                  color={urgencyColor(urgency)}
                />
              )}
              {benefit.used && <Badge label="Used" color={colors.green} />}
            </View>
          </View>
          <Switch
            value={benefit.used}
            onValueChange={onToggle}
            trackColor={{ true: colors.green, false: colors.border }}
          />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  verified: { color: colors.textDim, fontSize: 11, marginTop: space(3) },
  row: { flexDirection: 'row', alignItems: 'center' },
  benefitName: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: space(2) },
  struck: { textDecorationLine: 'line-through', color: colors.textDim },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  value: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
