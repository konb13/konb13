import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { getClient } from '@/data';
import type { CardCatalogEntry, User, UserCard } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, Card, Body, Button, Loading } from '@/ui/components';
import { colors, space } from '@/ui/theme';

interface CardsView {
  cards: UserCard[];
  members: User[];
  catalog: CardCatalogEntry[];
}

export default function Cards() {
  const { data, loading } = useAsync<CardsView>(async () => {
    const client = getClient();
    const [cards, members, catalog] = await Promise.all([
      client.listUserCards(),
      client.getMembers(),
      client.getCatalog(),
    ]);
    return { cards, members, catalog };
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { cards, members, catalog } = data ?? { cards: [], members: [], catalog: [] };
  const memberName = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Member';
  const catalogFor = (id: string) => catalog.find((c) => c.id === id);

  return (
    <Screen>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space(4) }}
        ListHeaderComponent={
          <View style={{ marginBottom: space(2), gap: space(2) }}>
            <Link href="/add-card" asChild>
              <Button label="+ Add a card" onPress={() => {}} />
            </Link>
            <Link href="/fee-analysis" asChild>
              <Button label="Annual fee decisions" variant="ghost" onPress={() => {}} />
            </Link>
          </View>
        }
        renderItem={({ item }) => {
          const cat = catalogFor(item.catalog_id);
          return (
            <Link href={{ pathname: '/card/[id]', params: { id: item.id } }} asChild>
              <Pressable>
                <Card>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {item.nickname ?? `${cat?.issuer ?? ''} ${cat?.product_name ?? 'Card'}`}
                      </Text>
                      <Body dim>
                        {memberName(item.user_id)}
                        {item.last4 ? ` · ••${item.last4}` : ''}
                        {cat?.annual_fee ? ` · $${cat.annual_fee}/yr` : ' · No annual fee'}
                      </Body>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: space(1) },
  chevron: { color: colors.textDim, fontSize: 28, paddingLeft: space(2) },
});
