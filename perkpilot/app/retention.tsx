import { Stack, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClient } from '@/data';
import type { CardCatalogEntry, RetentionStats } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Pill, Loading, EmptyState } from '@/ui/components';
import { space, typography, useTheme } from '@/ui/theme';

interface RetentionView {
  stats: RetentionStats[];
  catalog: CardCatalogEntry[];
}

export default function Retention() {
  const { c } = useTheme();
  const { data, loading } = useAsync<RetentionView>(async () => {
    const client = getClient();
    const [stats, catalog] = await Promise.all([client.getRetentionStats(), client.getCatalog()]);
    return { stats, catalog };
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { stats, catalog } = data ?? { stats: [], catalog: [] };
  const name = (id: string) => {
    const cat = catalog.find((x) => x.id === id);
    return cat ? `${cat.issuer} ${cat.product_name}` : 'Card';
  };

  return (
    <Screen scroll>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/log-retention')} hitSlop={12}>
              <Ionicons name="add" size={26} color={c.accent} />
            </Pressable>
          ),
        }}
      />
      <Text style={[typography.subhead, { color: c.textSecondary, marginHorizontal: space(5), marginTop: space(2), marginBottom: space(3) }]}>
        What real cardholders were offered to keep a card. Crowdsourced and anonymized — call
        retention before you cancel.
      </Text>

      {stats.length === 0 ? (
        <View style={{ marginTop: space(12) }}>
          <EmptyState icon="chatbubbles" title="No reports yet" message="Be the first to log a retention offer." />
        </View>
      ) : (
        stats.map((s) => (
          <Card key={s.catalog_id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.headline, { color: c.text, flex: 1, paddingRight: space(2) }]}>{name(s.catalog_id)}</Text>
              <Pill label={`${s.sample_size} report${s.sample_size === 1 ? '' : 's'}`} color={c.accent} />
            </View>

            <View style={{ flexDirection: 'row', gap: space(6), marginTop: space(3) }}>
              <Stat label="Got an offer" value={`${Math.round(s.offer_rate * 100)}%`} color={c.green} />
              {s.median_value_usd != null ? (
                <Stat label="Median value" value={`$${s.median_value_usd.toLocaleString()}`} color={c.text} />
              ) : null}
              {s.typical_points != null ? (
                <Stat label="Typical points" value={`${(s.typical_points / 1000).toFixed(0)}k`} color={c.text} />
              ) : null}
            </View>

            {s.latest_note ? (
              <Text style={[typography.footnote, { color: c.textSecondary, marginTop: space(3), fontStyle: 'italic' }]}>
                “{s.latest_note}”
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={{ ...typography.title3, color }}>{value}</Text>
      <Text style={[typography.caption, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}
