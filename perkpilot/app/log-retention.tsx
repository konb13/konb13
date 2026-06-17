import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getClient } from '@/data';
import type {
  CardCatalogEntry,
  RetentionChannel,
  RetentionOfferType,
  RetentionOutcome,
  UserCard,
} from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Button, SegmentedControl, SectionHeader, Loading } from '@/ui/components';
import { radius, space, typography, useTheme } from '@/ui/theme';

interface LogData {
  cards: UserCard[];
  catalog: CardCatalogEntry[];
}

const CHANNELS: { label: string; value: RetentionChannel }[] = [
  { label: 'Phone', value: 'phone' },
  { label: 'Chat', value: 'chat' },
  { label: 'In app', value: 'app' },
];
const OUTCOMES: { label: string; value: RetentionOutcome }[] = [
  { label: 'Kept', value: 'kept' },
  { label: 'Downgraded', value: 'downgraded' },
  { label: 'Canceled', value: 'canceled' },
];
const OFFER_TYPES: { label: string; value: RetentionOfferType }[] = [
  { label: 'Points', value: 'points' },
  { label: 'Credit', value: 'statement_credit' },
  { label: 'Fee waiver', value: 'fee_waiver' },
  { label: 'None', value: 'none' },
];

export default function LogRetention() {
  const { c } = useTheme();
  const { data, loading } = useAsync<LogData>(async () => {
    const client = getClient();
    const [cards, catalog] = await Promise.all([client.listUserCards(), client.getCatalog()]);
    return { cards, catalog };
  });

  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [channel, setChannel] = useState<RetentionChannel>('phone');
  const [outcome, setOutcome] = useState<RetentionOutcome>('kept');
  const [offerType, setOfferType] = useState<RetentionOfferType>('points');
  const [points, setPoints] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { cards, catalog } = data ?? { cards: [], catalog: [] };
  // De-duplicate the household's cards down to distinct catalog products.
  const options = useMemo(() => {
    const ids = Array.from(new Set(cards.map((c) => c.catalog_id)));
    return ids.map((id) => {
      const cat = catalog.find((x) => x.id === id);
      return { label: cat ? cat.product_name : 'Card', value: id };
    });
  }, [cards, catalog]);

  const activeCatalog = catalogId ?? options[0]?.value ?? null;

  const submit = async () => {
    if (!activeCatalog) return;
    setSaving(true);
    await getClient().addRetentionOffer({
      catalog_id: activeCatalog,
      channel,
      outcome,
      offer_type: offerType,
      points_offered: offerType === 'points' && points ? parseInt(points, 10) : null,
      value_usd: value ? parseFloat(value) : null,
      spend_required: null,
      note: note.trim() || null,
    });
    router.back();
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <SectionHeader>Card</SectionHeader>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((o) => {
          const active = o.value === activeCatalog;
          return (
            <Text
              key={o.value}
              onPress={() => setCatalogId(o.value)}
              style={[
                styles.chip,
                { backgroundColor: active ? c.accent : c.surface, color: active ? '#fff' : c.text },
              ]}
            >
              {o.label}
            </Text>
          );
        })}
      </ScrollView>

      <Card style={{ marginTop: space(3), gap: space(4) }}>
        <Field label="Channel">
          <SegmentedControl options={CHANNELS} value={channel} onChange={setChannel} />
        </Field>
        <Field label="Offer">
          <SegmentedControl options={OFFER_TYPES} value={offerType} onChange={setOfferType} />
        </Field>
        <Field label="Outcome">
          <SegmentedControl options={OUTCOMES} value={outcome} onChange={setOutcome} />
        </Field>

        {offerType === 'points' ? (
          <Field label="Points offered">
            <TextInput value={points} onChangeText={setPoints} keyboardType="number-pad" placeholder="50000" placeholderTextColor={c.textTertiary} style={[styles.input, { backgroundColor: c.fill, color: c.text }]} />
          </Field>
        ) : null}

        <Field label="Estimated value (USD)">
          <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="700" placeholderTextColor={c.textTertiary} style={[styles.input, { backgroundColor: c.fill, color: c.text }]} />
        </Field>

        <Field label="Note (optional)">
          <TextInput value={note} onChangeText={setNote} placeholder="e.g. 50k MR for $4k spend in 3 months" placeholderTextColor={c.textTertiary} multiline style={[styles.input, { backgroundColor: c.fill, color: c.text, minHeight: 64 }]} />
        </Field>
      </Card>

      <View style={{ paddingHorizontal: space(4) }}>
        <Button title={saving ? 'Saving…' : 'Log offer'} onPress={submit} loading={saving} disabled={!activeCatalog} />
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      <Text style={[typography.footnote, { color: c.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: space(4), gap: space(2), paddingVertical: space(1) },
  chip: { ...typography.footnote, fontWeight: '600', overflow: 'hidden', paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill },
  input: { borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(3), fontSize: 16 },
});
