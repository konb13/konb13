import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClient } from '@/data';
import type { CardCatalogEntry, User } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Section, Row, SegmentedControl, Loading } from '@/ui/components';
import { issuerAccent, radius, space, useTheme } from '@/ui/theme';

interface AddView {
  catalog: CardCatalogEntry[];
  members: User[];
}

export default function AddCard() {
  const { c } = useTheme();
  const { data, loading } = useAsync<AddView>(async () => {
    const client = getClient();
    const [catalog, members] = await Promise.all([client.getCatalog(), client.getMembers()]);
    return { catalog, members };
  });

  const [memberId, setMemberId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const { catalog, members } = data ?? { catalog: [], members: [] };
  const activeMember = memberId ?? members[0]?.id ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => `${c.issuer} ${c.product_name}`.toLowerCase().includes(q));
  }, [catalog, query]);

  const onPick = async (entry: CardCatalogEntry) => {
    if (!activeMember || saving) return;
    setSaving(true);
    const today = new Date();
    const due = new Date(today);
    due.setFullYear(due.getFullYear() + 1);
    await getClient().addUserCard({
      user_id: activeMember,
      catalog_id: entry.id,
      opened_date: today.toISOString().slice(0, 10),
      annual_fee_due_date: due.toISOString().slice(0, 10),
      last4: null,
      nickname: null,
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
      <View style={{ paddingHorizontal: space(4), paddingTop: space(4), gap: space(3) }}>
        <SegmentedControl
          options={members.map((m) => ({ label: m.display_name, value: m.id }))}
          value={activeMember}
          onChange={setMemberId}
        />
        <View style={[styles.search, { backgroundColor: c.surface }]}>
          <Ionicons name="search" size={17} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the catalog"
            placeholderTextColor={c.textTertiary}
            style={[styles.searchInput, { color: c.text }]}
            autoCorrect={false}
          />
        </View>
      </View>

      <Section style={{ marginTop: space(3) }}>
        {filtered.map((item) => {
          const [accent] = issuerAccent(item.issuer);
          return (
            <Row
              key={item.id}
              icon="card"
              iconBg={accent}
              title={`${item.issuer} ${item.product_name}`}
              subtitle={`${item.network.toUpperCase()} · ${item.annual_fee ? `$${item.annual_fee}/yr` : 'No annual fee'} · ${item.benefits_template.length} benefit${item.benefits_template.length === 1 ? '' : 's'}`}
              chevron
              onPress={() => onPick(item)}
            />
          );
        })}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(2.5) },
  searchInput: { flex: 1, fontSize: 17 },
});
