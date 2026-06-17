import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClient, USE_MOCK_DATA } from '@/data';
import { Screen, Button } from '@/ui/components';
import { radius, space, typography, useTheme } from '@/ui/theme';

export default function SignIn() {
  const { c } = useTheme();
  const [email, setEmail] = useState(USE_MOCK_DATA ? 'kbykhovsky@gmail.com' : '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onSignIn = async () => {
    setBusy(true);
    setNote(null);
    try {
      await getClient().signIn(email.trim());
      if (USE_MOCK_DATA) router.replace('/(tabs)');
      else setNote('Check your email for a magic link to finish signing in.');
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.wrap}>
        <View style={[styles.logo, { backgroundColor: c.accent }]}>
          <Ionicons name="airplane" size={30} color="#fff" />
        </View>
        <Text style={[typography.largeTitle, { color: c.text, textAlign: 'center' }]}>PerkPilot</Text>
        <Text style={[typography.body, { color: c.textSecondary, textAlign: 'center', marginTop: space(2) }]}>
          Never lose a free night, a credit, or a point again — for you and your spouse, in one place.
        </Text>

        <View style={{ height: space(10) }} />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { backgroundColor: c.surface, color: c.text }]}
        />
        <View style={{ height: space(3) }} />
        <Button title={busy ? 'Signing in…' : 'Continue'} onPress={onSignIn} loading={busy} />
        {note ? (
          <Text style={[typography.footnote, { color: c.textSecondary, textAlign: 'center', marginTop: space(3) }]}>{note}</Text>
        ) : null}
      </View>
      {USE_MOCK_DATA ? (
        <Text style={[typography.caption, { color: c.textTertiary, textAlign: 'center', marginBottom: space(4) }]}>
          Running on bundled demo data
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: space(6) },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: space(5),
  },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(4),
    fontSize: 17,
  },
});
