import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getClient, USE_MOCK_DATA } from '@/data';
import { Screen, Title, Body, Button } from '@/ui/components';
import { colors, radius, space } from '@/ui/theme';

export default function SignIn() {
  const [email, setEmail] = useState(USE_MOCK_DATA ? 'kbykhovsky@gmail.com' : '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onSignIn = async () => {
    setBusy(true);
    setNote(null);
    try {
      await getClient().signIn(email.trim());
      if (USE_MOCK_DATA) {
        router.replace('/(tabs)');
      } else {
        setNote('Check your email for a magic link to finish signing in.');
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.logo}>PerkPilot</Text>
        <Title>Never lose a free night, a credit, or a point again.</Title>
        <Body dim>For you and your spouse, in one place.</Body>

        <View style={{ height: space(8) }} />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <Button label={busy ? 'Signing in…' : 'Continue'} onPress={onSignIn} />
        {note && <Body dim>{note}</Body>}

        {USE_MOCK_DATA && (
          <Text style={styles.mock}>Running on bundled demo data (no backend).</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space(6), gap: space(3) },
  logo: { color: colors.primary, fontSize: 16, fontWeight: '800', letterSpacing: 1.5, marginBottom: space(4) },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    fontSize: 16,
  },
  mock: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: space(4) },
});
