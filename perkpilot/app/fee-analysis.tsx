import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClient } from '@/data';
import type { FeeAnalysis, FeeRecommendation, RetentionStats } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Pill, ProgressBar, Loading, EmptyState } from '@/ui/components';
import { radius, space, typography, useTheme, type Palette } from '@/ui/theme';

function renderRetentionHint(a: FeeAnalysis, stats: RetentionStats | undefined, c: Palette) {
  // Only nudge when the math says downgrade/cancel — "call retention first".
  if (!stats || (a.recommendation !== 'downgrade' && a.recommendation !== 'cancel')) return null;
  const value = stats.median_value_usd
    ? `~$${stats.median_value_usd.toLocaleString()}`
    : stats.typical_points
      ? `~${(stats.typical_points / 1000).toFixed(0)}k pts`
      : 'an offer';
  return (
    <Pressable
      onPress={() => router.push('/retention')}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(2),
          marginTop: space(3),
          padding: space(3),
          borderRadius: radius.sm,
          backgroundColor: c.accentSoft,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name="chatbubbles" size={18} color={c.accent} />
      <Text style={[typography.footnote, { color: c.accent, flex: 1, fontWeight: '600' }]}>
        {Math.round(stats.offer_rate * 100)}% of members got {value} to keep this. Call retention before canceling.
      </Text>
      <Ionicons name="chevron-forward" size={16} color={c.accent} />
    </Pressable>
  );
}

const recMeta = (r: FeeRecommendation, c: Palette): { label: string; color: string } => {
  switch (r) {
    case 'keep':
      return { label: 'Keep', color: c.green };
    case 'keep_if_used':
      return { label: 'Keep if used', color: c.amber };
    case 'downgrade':
      return { label: 'Downgrade', color: c.amber };
    case 'cancel':
      return { label: 'Cancel', color: c.red };
  }
};

interface FeeView {
  items: FeeAnalysis[];
  retention: Record<string, RetentionStats>;
}

export default function FeeAnalysisScreen() {
  const { c } = useTheme();
  const { data, loading } = useAsync<FeeView>(async () => {
    const client = getClient();
    const [items, stats] = await Promise.all([client.getFeeDecisions(120), client.getRetentionStats()]);
    const retention = Object.fromEntries(stats.map((s) => [s.catalog_id, s]));
    return { items, retention };
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { items, retention } = data ?? { items: [], retention: {} };

  return (
    <Screen scroll>
      <Text style={[typography.subhead, { color: c.textSecondary, marginHorizontal: space(5), marginTop: space(2), marginBottom: space(3) }]}>
        Cards with a fee posting in the next 120 days, and whether the benefits you'll
        realistically use justify it.
      </Text>

      {items.length === 0 ? (
        <View style={{ marginTop: space(12) }}>
          <EmptyState icon="checkmark-circle" title="No fees due soon" message="Nothing to decide right now." />
        </View>
      ) : (
        items.map((a) => {
          const meta = recMeta(a.recommendation, c);
          const pct = a.annual_fee > 0 ? a.realized_value / a.annual_fee : 1;
          return (
            <Card key={a.user_card_id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(1) }}>
                <Text style={[typography.headline, { color: c.text, flex: 1, paddingRight: space(2) }]}>{a.card_name}</Text>
                <Pill label={meta.label} color={meta.color} soft={false} />
              </View>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>
                ${a.annual_fee.toLocaleString()}/yr{a.days_until_fee != null ? ` · due in ${a.days_until_fee} days` : ''}
              </Text>

              {a.annual_fee > 0 ? (
                <View style={{ marginTop: space(3) }}>
                  <ProgressBar progress={pct} color={pct >= 1 ? c.green : c.accent} />
                  <Text style={[typography.caption, { color: c.textSecondary, marginTop: space(2) }]}>
                    ${a.realized_value.toLocaleString()} used
                    {a.remaining_value > 0 ? ` · $${a.remaining_value.toLocaleString()} still available` : ''} of $
                    {a.annual_fee.toLocaleString()}
                  </Text>
                </View>
              ) : null}

              <Text style={[typography.subhead, { color: c.text, marginTop: space(3), lineHeight: 20 }]}>{a.headline}</Text>

              {renderRetentionHint(a, retention[a.catalog_id], c)}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
