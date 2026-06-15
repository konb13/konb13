import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getClient, getSignupBonus } from '@/data';
import type { CardCatalogEntry, PlanMove, TwoPlayerPlan, User, WantedBy } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Badge, Button, Loading, Empty } from '@/ui/components';
import { colors, radius, space } from '@/ui/theme';

interface PickerData {
  catalog: CardCatalogEntry[];
  members: User[];
}

export default function TwoPlayer() {
  const { data, loading } = useAsync<PickerData>(async () => {
    const client = getClient();
    const [catalog, members] = await Promise.all([client.getCatalog(), client.getMembers()]);
    return { catalog: catalog.filter((c) => getSignupBonus(c.id)), members };
  });

  // catalog_id -> wanted_by selection.
  const [picks, setPicks] = useState<Record<string, WantedBy>>({ cat_csp: 'both' });
  const [plan, setPlan] = useState<TwoPlayerPlan | null>(null);
  const [planning, setPlanning] = useState(false);

  const { catalog, members } = data ?? { catalog: [], members: [] };

  const cycle = (catalogId: string, value: WantedBy) =>
    setPicks((prev) => {
      const next = { ...prev };
      if (next[catalogId] === value) delete next[catalogId];
      else next[catalogId] = value;
      return next;
    });

  const targets = useMemo(
    () => Object.entries(picks).map(([catalog_id, wanted_by]) => ({ catalog_id, wanted_by })),
    [picks],
  );

  const generate = async () => {
    setPlanning(true);
    const result = await getClient().getTwoPlayerPlan(targets);
    setPlan(result);
    setPlanning(false);
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (plan) {
    return <PlanResults plan={plan} onBack={() => setPlan(null)} />;
  }

  return (
    <Screen>
      <FlatList
        data={catalog}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space(4), paddingBottom: space(24) }}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Pick the cards you want and who should get each. PerkPilot sequences the
            applications across both of you — Chase 5/24 first, then routes shared
            cards so one of you refers the other.
          </Text>
        }
        renderItem={({ item }) => {
          const bonus = getSignupBonus(item.id)!;
          const selected = picks[item.id];
          return (
            <Card>
              <Text style={styles.cardName}>
                {item.issuer} {item.product_name}
              </Text>
              <Body dim>
                ~${bonus.bonus_value_usd.toLocaleString()} bonus · ${bonus.min_spend_usd.toLocaleString()} in{' '}
                {bonus.min_spend_months} mo
                {bonus.referral_bonus_usd ? ` · +$${bonus.referral_bonus_usd} referral` : ''}
              </Body>
              <View style={styles.chipRow}>
                {members.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.display_name}
                    active={selected === m.id}
                    onPress={() => cycle(item.id, m.id)}
                  />
                ))}
                <Chip label="Both" active={selected === 'both'} onPress={() => cycle(item.id, 'both')} />
              </View>
            </Card>
          );
        }}
      />
      <View style={styles.footer}>
        <Button
          label={planning ? 'Planning…' : `Plan ${targets.length} card${targets.length === 1 ? '' : 's'}`}
          onPress={generate}
        />
      </View>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function PlanResults({ plan, onBack }: { plan: TwoPlayerPlan; onBack: () => void }) {
  return (
    <Screen>
      <FlatList
        data={plan.moves}
        keyExtractor={(m) => String(m.order)}
        contentContainerStyle={{ padding: space(4) }}
        ListHeaderComponent={
          <View>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>ESTIMATED HOUSEHOLD VALUE</Text>
              <Text style={styles.total}>${plan.total_bonus_value_usd.toLocaleString()}</Text>
              <Body dim>Welcome offers + referral bonuses across {plan.moves.length} applications.</Body>
            </View>

            <View style={styles.statusRow}>
              {plan.members.map((m) => (
                <View key={m.member_id} style={styles.statusPill}>
                  <Text style={styles.statusName}>{m.name}</Text>
                  <Text style={[styles.statusVal, { color: m.under_524 ? colors.green : colors.red }]}>
                    {m.current_524}/24
                  </Text>
                  {!m.under_524 && m.next_524_opens_at && (
                    <Text style={styles.statusSub}>opens {m.next_524_opens_at}</Text>
                  )}
                </View>
              ))}
            </View>

            {plan.notes.map((n, i) => (
              <Text key={i} style={styles.note}>• {n}</Text>
            ))}

            <Text style={styles.section}>THE SEQUENCE</Text>
          </View>
        }
        renderItem={({ item }) => <MoveRow move={item} />}
        ListEmptyComponent={<Empty message="No applications fit the rules. Try fewer Chase cards or check 5/24." />}
        ListFooterComponent={
          <View style={{ marginTop: space(4) }}>
            {plan.unscheduled.length > 0 && (
              <>
                <Text style={styles.section}>NOT SCHEDULED</Text>
                {plan.unscheduled.map((u, i) => (
                  <Card key={i}>
                    <Text style={styles.cardName}>{u.card_name}</Text>
                    <Body dim>{u.reason}</Body>
                  </Card>
                ))}
              </>
            )}
            <View style={{ height: space(3) }} />
            <Button label="Adjust picks" variant="ghost" onPress={onBack} />
          </View>
        }
      />
    </Screen>
  );
}

function MoveRow({ move }: { move: PlanMove }) {
  return (
    <Card>
      <View style={styles.moveHead}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{move.order}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{move.card_name}</Text>
          <Body dim>
            {move.member_name} · apply ~{move.date}
          </Body>
        </View>
        <Badge label={`$${move.bonus_value_usd.toLocaleString()}`} color={colors.green} />
      </View>
      {move.refer_from_member_name && (
        <Text style={styles.referral}>
          ↳ Referred by {move.refer_from_member_name} (+${move.referral_bonus_usd})
        </Text>
      )}
      {move.rationale.map((r, i) => (
        <Text key={i} style={styles.rationale}>• {r}</Text>
      ))}
      <Text style={styles.deadline}>
        Min spend ${move.min_spend_usd.toLocaleString()} by {move.min_spend_deadline}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: space(3) },
  cardName: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: space(1) },
  chipRow: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  chip: {
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space(4),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalCard: { paddingVertical: space(3) },
  totalLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  total: { color: colors.text, fontSize: 38, fontWeight: '800', marginVertical: space(1) },
  statusRow: { flexDirection: 'row', gap: space(3), marginVertical: space(3) },
  statusPill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space(3),
    flex: 1,
  },
  statusName: { color: colors.text, fontWeight: '600' },
  statusVal: { fontSize: 20, fontWeight: '800', marginTop: space(1) },
  statusSub: { color: colors.textDim, fontSize: 11, marginTop: space(1) },
  note: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: space(1) },
  section: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: space(4), marginBottom: space(2) },
  moveHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: { color: '#fff', fontWeight: '800' },
  referral: { color: colors.primary, fontSize: 13, marginTop: space(2), fontWeight: '600' },
  rationale: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: space(2) },
  deadline: { color: colors.amber, fontSize: 12, marginTop: space(3), fontWeight: '600' },
});
