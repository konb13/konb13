import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getClient } from '@/data';
import type { CardCatalogEntry, User } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Loading } from '@/ui/components';
import { colors, radius, space } from '@/ui/theme';

interface AddView {
  catalog: CardCatalogEntry[];
  members: User[];
}

export default function AddCard() {
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
    return catalog.filter((c) =>
      `${c.issuer} ${c.product_name}`.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  const onPick = async (entry: CardCatalogEntry) => {
    if (!activeMember || saving) return;
    setSaving(true);
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    await getClient().addUserCard({
      user_id: activeMember,
      catalog_id: entry.id,
      opened_date: today.toISOString().slice(0, 10),
      annual_fee_due_date: dueDate.toISOString().slice(0, 10),
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
    <Screen>
      <View style={styles.controls}>
        <View style={styles.memberRow}>
          {members.map((m) => {
            const selected = m.id === activeMember;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMemberId(m.id)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipText, selected && { color: '#fff' }]}>
                  {m.display_name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search the catalog…"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space(4) }}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} disabled={saving}>
            <Card>
              <Text style={styles.name}>
                {item.issuer} {item.product_name}
              </Text>
              <Body dim>
                {item.network.toUpperCase()} ·{' '}
                {item.annual_fee ? `$${item.annual_fee}/yr` : 'No annual fee'} ·{' '}
                {item.benefits_template.length} benefit
                {item.benefits_template.length === 1 ? '' : 's'}
              </Body>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { padding: space(4), paddingBottom: space(2), gap: space(3) },
  memberRow: { flexDirection: 'row', gap: space(2) },
  chip: {
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textDim, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    fontSize: 15,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: space(1) },
});
