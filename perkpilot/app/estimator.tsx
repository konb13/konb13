import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { estimatePoints, type Confidence } from '@/data/estimator';
import { PROGRAM_LIST, PROGRAM_REFERENCE } from '@/data/programReference';
import type { LoyaltyProgram } from '@/data';
import { Screen, Card, Pill, Button, SectionHeader } from '@/ui/components';
import { radius, space, typography, useTheme, type Palette } from '@/ui/theme';

const HYATT_TIERS = [
  { label: 'Off-peak', value: 'off_peak' as const },
  { label: 'Standard', value: 'standard' as const },
  { label: 'Peak', value: 'peak' as const },
];

const confidenceColor = (conf: Confidence, c: Palette): string =>
  conf === 'HIGH' ? c.green : conf === 'MEDIUM-HIGH' ? c.green : conf === 'MEDIUM' ? c.amber : c.red;

export default function Estimator() {
  const { c } = useTheme();
  const [program, setProgram] = useState<LoyaltyProgram>('hyatt');
  const [cash, setCash] = useState('400');
  const [hyattCategory, setHyattCategory] = useState(4);
  const [hyattTier, setHyattTier] = useState<'off_peak' | 'standard' | 'peak'>('standard');

  const isHyatt = PROGRAM_REFERENCE[program].pricing_model === 'fixed_chart';

  const estimate = useMemo(() => {
    const cashNum = parseFloat(cash) || 0;
    return estimatePoints(program, cashNum, isHyatt ? { hyattCategory, hyattTier } : {});
  }, [program, cash, hyattCategory, hyattTier, isHyatt]);

  const [low, high] = estimate.range;
  const rangeText = low === high ? `${low.toLocaleString()}` : `${low.toLocaleString()}–${high.toLocaleString()}`;

  return (
    <Screen scroll>
      <SectionHeader>Program</SectionHeader>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {PROGRAM_LIST.map((p) => {
          const active = p.program === program;
          return (
            <Pressable
              key={p.program}
              onPress={() => setProgram(p.program)}
              style={[styles.chip, { backgroundColor: active ? c.accent : c.surface }]}
            >
              <Text style={{ ...typography.footnote, fontWeight: '600', color: active ? '#fff' : c.text }}>
                {p.display_name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card style={{ marginTop: space(3) }}>
        <Text style={[typography.footnote, { color: c.textSecondary, marginBottom: space(2) }]}>
          Cash price of the stay or flight (USD)
        </Text>
        <View style={[styles.cashRow, { borderColor: c.separator }]}>
          <Text style={[typography.title, { color: c.textSecondary }]}>$</Text>
          <TextInput
            value={cash}
            onChangeText={setCash}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.textTertiary}
            style={[typography.title, styles.cashInput, { color: c.text }]}
          />
        </View>

        {isHyatt ? (
          <View style={{ marginTop: space(4) }}>
            <Text style={[typography.footnote, { color: c.textSecondary, marginBottom: space(2) }]}>Hyatt category</Text>
            <View style={styles.catRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
                const active = n === hyattCategory;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setHyattCategory(n)}
                    style={[styles.cat, { backgroundColor: active ? c.accent : c.fill }]}
                  >
                    <Text style={{ ...typography.subhead, fontWeight: '600', color: active ? '#fff' : c.text }}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.tierRow, { marginTop: space(3) }]}>
              {HYATT_TIERS.map((t) => {
                const active = t.value === hyattTier;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setHyattTier(t.value)}
                    style={[styles.tier, { backgroundColor: active ? c.accentSoft : 'transparent', borderColor: active ? c.accent : c.separator }]}
                  >
                    <Text style={{ ...typography.footnote, fontWeight: '600', color: active ? c.accent : c.textSecondary }}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.footnote, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Estimated cost
          </Text>
          <Pill label={estimate.confidence} color={confidenceColor(estimate.confidence, c)} soft={false} />
        </View>
        <Text style={[styles.range, { color: c.text }]}>{rangeText}</Text>
        <Text style={[typography.subhead, { color: c.textSecondary }]}>points</Text>
        <Text style={[typography.footnote, { color: c.textSecondary, marginTop: space(3), lineHeight: 18 }]}>
          {estimate.flag}
        </Text>
        {estimate.deepLink ? (
          <View style={{ marginTop: space(4) }}>
            <Button title="Confirm availability" icon="open-outline" variant="tinted" onPress={() => Linking.openURL(estimate.deepLink!)} />
          </View>
        ) : null}
      </Card>

      <Text style={[typography.caption, { color: c.textTertiary, marginHorizontal: space(5), marginTop: space(2) }]}>
        Always a range, never a promise. We log your confirmed redemptions to tighten these estimates over time.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipScroll: { paddingHorizontal: space(4), gap: space(2), paddingVertical: space(1) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill },
  cashRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space(2), gap: space(1) },
  cashInput: { flex: 1, padding: 0 },
  catRow: { flexDirection: 'row', gap: space(2), justifyContent: 'space-between' },
  cat: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tierRow: { flexDirection: 'row', gap: space(2) },
  tier: { flex: 1, alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.sm, borderWidth: 1 },
  range: { ...typography.largeTitle, fontSize: 40, marginTop: space(2) },
});
