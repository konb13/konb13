import { router } from 'expo-router';
import { getClient } from '@/data';
import type { CardCatalogEntry, User, UserCard } from '@/data';
import { useAsync } from '@/hooks/useAsync';
import { Screen, LargeTitle, Section, Row, Loading } from '@/ui/components';
import { issuerAccent, space, useTheme } from '@/ui/theme';

interface CardsView {
  cards: UserCard[];
  members: User[];
  catalog: CardCatalogEntry[];
}

export default function Cards() {
  const { c } = useTheme();
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
  const catalogFor = (id: string) => catalog.find((c) => c.id === id);

  return (
    <Screen scroll>
      <LargeTitle>Cards</LargeTitle>

      <Section header="Plan">
        <Row icon="add-circle" iconBg={c.accent} title="Add a card" chevron onPress={() => router.push('/add-card')} />
        <Row icon="cut" iconBg={c.amber} title="Annual fee decisions" chevron onPress={() => router.push('/fee-analysis')} />
        <Row icon="people" iconBg={c.green} title="Two-player bonus plan" chevron onPress={() => router.push('/two-player')} />
        <Row icon="calculator" iconBg={c.accent} title="Points estimator" chevron onPress={() => router.push('/estimator')} />
      </Section>

      {members.map((m) => {
        const mine = cards.filter((card) => card.user_id === m.id);
        if (mine.length === 0) return null;
        return (
          <Section key={m.id} header={m.display_name} style={{ marginBottom: space(1) }}>
            {mine.map((card) => {
              const cat = catalogFor(card.catalog_id);
              const [accent] = issuerAccent(cat?.issuer ?? '');
              return (
                <Row
                  key={card.id}
                  icon="card"
                  iconBg={accent}
                  title={card.nickname ?? `${cat?.issuer ?? ''} ${cat?.product_name ?? 'Card'}`}
                  subtitle={cat?.annual_fee ? `$${cat.annual_fee}/yr` : 'No annual fee'}
                  chevron
                  onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
                />
              );
            })}
          </Section>
        );
      })}
    </Screen>
  );
}
