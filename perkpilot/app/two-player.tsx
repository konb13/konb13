import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getClient, getSignupBonus } from '@/data';
import type { CardCatalogEntry, PlanMove, TwoPlayerPlan, User, WantedBy } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Pill, Button, SegmentedControl, SectionHeader, Loading } from '@/ui/components';
import { radius, space, typography, useTheme } from '@/ui/theme';

interface PickerData {
  catalog: CardCatalogEntry[];
  members: User[];
}

export default function TwoPlayer() {
  const { c } = useTheme();
  const { data, loading } = useAsync<PickerData>(async () => {
    const client = getClient();
    const [catalog, members] = await Promise.all([client.getCatalog(), client.getMembers()]);
    return { catalog: catalog.filter((c) => getSignupBonus(c.id)), members };
  });

  const [picks, setPicks] = useState<Record<string, WantedBy>>({ cat_csp: 'both' });
  const [plan, setPlan] = useState<TwoPlayerPlan | null>(null);
  const [planning, setPlanning] = useState(false);

  const { catalog, members } = data ?? { catalog: [], members: [] };

  const toggle = (catalogId: string, value: WantedBy) =>
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
    setPlan(await getClient().getTwoPlayerPlan(targets));
    setPlanning(false);
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (plan) return <PlanResults plan={plan} onBack={() => setPlan(null)} />;

  const options: { label: string; value: WantedBy }[] = [
    ...members.map((m) => ({ label: m.display_name, value: m.id })),
    { label: 'Both', value: 'both' },
  ];

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <Text style={[typography.subhead, { color: c.textSecondary, marginHorizontal: space(5), marginTop: space(3), marginBottom: space(2) }]}>
        Pick the cards you want and who should get each. We sequence the applications across
        both of you — Chase 5/24 first, then route shared cards through a referral.
      </Text>

      <SectionHeader>Welcome offers</SectionHeader>
      {catalog.map((item) => {
        const bonus = getSignupBonus(item.id)!;
        return (
          <Card key={item.id}>
            <Text style={[typography.headline, { color: c.text }]}>
              {item.issuer} {item.product_name}
            </Text>
            <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2, marginBottom: space(3) }]}>
              ~${bonus.bonus_value_usd.toLocaleString()} bonus · ${bonus.min_spend_usd.toLocaleString()} in {bonus.min_spend_months} mo
              {bonus.referral_bonus_usd ? ` · +$${bonus.referral_bonus_usd} referral` : ''}
            </Text>
            <SegmentedControl options={options} value={picks[item.id] ?? null} onChange={(v) => toggle(item.id, v)} />
          </Card>
        );
      })}

      <View style={{ paddingHorizontal: space(4), marginTop: space(2) }}>
        <Button
          title={planning ? 'Planning…' : `Plan ${targets.length} card${targets.length === 1 ? '' : 's'}`}
          onPress={generate}
          loading={planning}
          disabled={targets.length === 0}
        />
      </View>
    </Screen>
  );
}

function PlanResults({ plan, onBack }: { plan: TwoPlayerPlan; onBack: () => void }) {
  const { c } = useTheme();
  return (
    <Screen scroll>
      <Card style={{ paddingVertical: space(5) }}>
        <Text style={[typography.footnote, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          Estimated household value
        </Text>
        <Text style={[styles.total, { color: c.text }]}>${plan.total_bonus_value_usd.toLocaleString()}</Text>
        <Text style={[typography.subhead, { color: c.textSecondary }]}>
          Welcome offers + referral bonuses across {plan.moves.length} applications.
        </Text>
        <View style={styles.statusRow}>
          {plan.members.map((m) => (
            <View key={m.member_id} style={[styles.statusPill, { backgroundColor: c.fill }]}>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{m.name}</Text>
              <Text style={{ ...typography.title3, color: m.under_524 ? c.green : c.red }}>{m.current_524}/24</Text>
              {!m.under_524 && m.next_524_opens_at ? (
                <Text style={[typography.caption, { color: c.textTertiary }]}>opens {m.next_524_opens_at}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </Card>

      {plan.notes.length > 0 ? (
        <View style={{ marginHorizontal: space(5), marginBottom: space(2) }}>
          {plan.notes.map((n, i) => (
            <Text key={i} style={[typography.footnote, { color: c.textSecondary, lineHeight: 18, marginTop: space(1) }]}>• {n}</Text>
          ))}
        </View>
      ) : null}

      <SectionHeader>The sequence</SectionHeader>
      {plan.moves.map((m) => <MoveCard key={m.order} move={m} />)}

      {plan.unscheduled.length > 0 ? (
        <>
          <SectionHeader>Not scheduled</SectionHeader>
          {plan.unscheduled.map((u, i) => (
            <Card key={i}>
              <Text style={[typography.headline, { color: c.text }]}>{u.card_name}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>{u.reason}</Text>
            </Card>
          ))}
        </>
      ) : null}

      <View style={{ paddingHorizontal: space(4), marginTop: space(3) }}>
        <Button title="Adjust picks" variant="tinted" icon="chevron-back" onPress={onBack} />
      </View>
    </Screen>
  );
}

function MoveCard({ move }: { move: PlanMove }) {
  const { c } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View style={[styles.order, { backgroundColor: c.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{move.order}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headline, { color: c.text }]}>{move.card_name}</Text>
          <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>
            {move.member_name} · apply ~{move.date}
          </Text>
        </View>
        <Pill label={`$${move.bonus_value_usd.toLocaleString()}`} color={c.green} soft={false} />
      </View>

      {move.refer_from_member_name ? (
        <Text style={[typography.footnote, { color: c.accent, marginTop: space(3), fontWeight: '600' }]}>
          ↳ Referred by {move.refer_from_member_name} (+${move.referral_bonus_usd})
        </Text>
      ) : null}

      {move.rationale.map((r, i) => (
        <Text key={i} style={[typography.footnote, { color: c.textSecondary, lineHeight: 18, marginTop: space(2) }]}>• {r}</Text>
      ))}

      <View style={[styles.deadline, { backgroundColor: c.fill }]}>
        <Text style={[typography.caption, { color: c.amber, fontWeight: '600' }]}>
          Spend ${move.min_spend_usd.toLocaleString()} by {move.min_spend_deadline}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  total: { ...typography.largeTitle, fontSize: 42, marginVertical: space(1) },
  statusRow: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  statusPill: { flex: 1, borderRadius: radius.md, padding: space(3), gap: 2 },
  order: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  deadline: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: space(2.5), paddingVertical: space(1.5), marginTop: space(3) },
});
