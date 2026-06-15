import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getClient } from '@/data';
import type { FeeAnalysis, FeeRecommendation } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Badge, Loading, Empty } from '@/ui/components';
import { colors, radius, space } from '@/ui/theme';

const REC_META: Record<FeeRecommendation, { label: string; color: string }> = {
  keep: { label: 'Keep', color: colors.green },
  keep_if_used: { label: 'Keep if used', color: colors.amber },
  downgrade: { label: 'Downgrade', color: colors.amber },
  cancel: { label: 'Cancel', color: colors.red },
};

export default function FeeAnalysisScreen() {
  const { data, loading } = useAsync<FeeAnalysis[]>(() => getClient().getFeeDecisions(120));

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.user_card_id}
        contentContainerStyle={{ padding: space(4) }}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Cards with a fee posting in the next 120 days, and whether the benefits
            you'll realistically use justify it.
          </Text>
        }
        ListEmptyComponent={<Empty message="No annual fees due soon. Nothing to decide." />}
        renderItem={({ item }) => <FeeCard analysis={item} />}
      />
    </Screen>
  );
}

function FeeCard({ analysis }: { analysis: FeeAnalysis }) {
  const meta = REC_META[analysis.recommendation];
  const pct = analysis.annual_fee > 0
    ? Math.min(1, analysis.realized_value / analysis.annual_fee)
    : 1;

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.name}>{analysis.card_name}</Text>
        <Badge label={meta.label} color={meta.color} />
      </View>

      <Body dim>
        ${analysis.annual_fee.toLocaleString()}/yr
        {analysis.days_until_fee != null ? ` · due in ${analysis.days_until_fee} days` : ''}
      </Body>

      {analysis.annual_fee > 0 && (
        <>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? colors.green : colors.primary },
              ]}
            />
          </View>
          <Text style={styles.scale}>
            ${analysis.realized_value.toLocaleString()} used
            {analysis.remaining_value > 0
              ? ` · $${analysis.remaining_value.toLocaleString()} still available`
              : ''}
            {' '}of ${analysis.annual_fee.toLocaleString()}
          </Text>
        </>
      )}

      <Text style={styles.headline}>{analysis.headline}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textDim, fontSize: 13, marginBottom: space(3), lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(1) },
  name: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1, paddingRight: space(2) },
  track: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, marginTop: space(3), overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.sm },
  scale: { color: colors.textDim, fontSize: 12, marginTop: space(2) },
  headline: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: space(3) },
});
