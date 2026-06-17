import { View } from 'react-native';
import { router } from 'expo-router';
import { getClient } from '@/data';
import type { PointsAccount, User } from '@/data';
import { PROGRAM_REFERENCE, programLabel } from '@/data/programReference';
import { daysUntil } from '@/data/valueAtRisk';
import { useAsync } from '@/hooks/useAsync';
import { Screen, LargeTitle, Section, Row, Pill, Loading, EmptyState } from '@/ui/components';
import { space, urgencyColor, useTheme } from '@/ui/theme';

interface PointsView {
  accounts: PointsAccount[];
  members: User[];
}

export default function Points() {
  const { c } = useTheme();
  const { data, loading } = useAsync<PointsView>(async () => {
    const client = getClient();
    const [accounts, members] = await Promise.all([client.listPointsAccounts(), client.getMembers()]);
    return { accounts, members };
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const { accounts, members } = data ?? { accounts: [], members: [] };

  return (
    <Screen scroll>
      <LargeTitle>Points</LargeTitle>

      <Section header="Tools">
        <Row icon="calculator" iconBg={c.accent} title="Cash → points estimator" chevron onPress={() => router.push('/estimator')} />
      </Section>

      {accounts.length === 0 ? (
        <View style={{ marginTop: space(12) }}>
          <EmptyState icon="sparkles" title="No loyalty accounts yet" />
        </View>
      ) : (
        members.map((m) => {
          const mine = accounts.filter((a) => a.user_id === m.id);
          if (mine.length === 0) return null;
          return (
            <Section key={m.id} header={m.display_name}>
              {mine.map((a) => {
                const ref = PROGRAM_REFERENCE[a.program];
                const midValue = Math.round((a.balance * (ref?.cpp_mid ?? 1)) / 100);
                const deadline = a.hard_deadline ?? a.inactivity_deadline;
                const days = daysUntil(deadline);
                const urgency = days === null ? 'green' : days <= 30 ? 'red' : days <= 120 ? 'amber' : 'green';
                return (
                  <Row
                    key={a.id}
                    icon="sparkles"
                    iconBg={c.accent}
                    title={programLabel(a.program)}
                    subtitle={`${a.balance.toLocaleString()} pts · ~$${midValue.toLocaleString()}`}
                    trailing={
                      deadline ? (
                        <Pill
                          label={days !== null && days <= 0 ? 'Expired' : `${days}d`}
                          color={urgencyColor(urgency, c)}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </Section>
          );
        })
      )}
    </Screen>
  );
}
