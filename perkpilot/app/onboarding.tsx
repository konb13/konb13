import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getClient } from '@/data';
import { Screen, Card, Button, SegmentedControl, SectionHeader } from '@/ui/components';
import { radius, space, typography, useTheme } from '@/ui/theme';

type Mode = 'create' | 'join';

export default function Onboarding() {
  const { c } = useTheme();
  const [mode, setMode] = useState<Mode>('create');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        await getClient().createHousehold(householdName.trim(), displayName.trim());
      } else {
        await getClient().joinHousehold(code.trim(), displayName.trim());
      }
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = displayName.trim().length > 0 && (mode === 'create' ? true : code.trim().length > 0);

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: space(5), paddingTop: space(6) }}>
        <Text style={[typography.largeTitle, { color: c.text }]}>Set up your household</Text>
        <Text style={[typography.body, { color: c.textSecondary, marginTop: space(2) }]}>
          One shared dataset for you and your spouse. Create a new household, or join one your
          partner already made.
        </Text>
      </View>

      <View style={{ paddingHorizontal: space(4), marginTop: space(5) }}>
        <SegmentedControl
          options={[
            { label: 'Create new', value: 'create' },
            { label: 'Join with code', value: 'join' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>

      <SectionHeader>Your name</SectionHeader>
      <Card>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Konstantin"
          placeholderTextColor={c.textTertiary}
          style={[styles.input, { color: c.text }]}
        />
      </Card>

      {mode === 'create' ? (
        <>
          <SectionHeader>Household name</SectionHeader>
          <Card>
            <TextInput
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder="e.g. The Bykhovsky Household"
              placeholderTextColor={c.textTertiary}
              style={[styles.input, { color: c.text }]}
            />
          </Card>
        </>
      ) : (
        <>
          <SectionHeader>Invite code</SectionHeader>
          <Card>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="6-character code from your partner"
              placeholderTextColor={c.textTertiary}
              style={[styles.input, styles.code, { color: c.text }]}
            />
          </Card>
        </>
      )}

      <View style={{ paddingHorizontal: space(4), marginTop: space(3) }}>
        <Button
          title={busy ? 'Setting up…' : mode === 'create' ? 'Create household' : 'Join household'}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />
        {error ? (
          <Text style={[typography.footnote, { color: c.red, textAlign: 'center', marginTop: space(3) }]}>{error}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 17, paddingVertical: space(1) },
  code: { letterSpacing: 4, fontWeight: '600' },
});
