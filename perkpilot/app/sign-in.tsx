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
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await getClient().signIn(email.trim());
      if (USE_MOCK_DATA) return router.replace('/');
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await getClient().verifyOtp(email.trim(), code.trim());
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.wrap}>
        <View style={[styles.logo, { backgroundColor: c.accent }]}>
          <Ionicons name="paper-plane" size={28} color="#fff" />
        </View>
        <Text style={[typography.largeTitle, { color: c.text, textAlign: 'center' }]}>PerkPilot</Text>
        <Text style={[typography.body, { color: c.textSecondary, textAlign: 'center', marginTop: space(2) }]}>
          Never lose a free night, a credit, or a point again — for you and your spouse, in one place.
        </Text>

        <View style={{ height: space(10) }} />

        {step === 'email' ? (
          <>
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
            <Button title={busy ? 'Sending…' : 'Continue'} onPress={sendCode} loading={busy} />
          </>
        ) : (
          <>
            <Text style={[typography.footnote, { color: c.textSecondary, textAlign: 'center', marginBottom: space(3) }]}>
              We emailed a 6-digit code to {email}.
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={c.textTertiary}
              keyboardType="number-pad"
              style={[styles.input, styles.code, { backgroundColor: c.surface, color: c.text }]}
            />
            <View style={{ height: space(3) }} />
            <Button title={busy ? 'Verifying…' : 'Verify'} onPress={verify} loading={busy} />
            <View style={{ height: space(2) }} />
            <Button title="Use a different email" variant="plain" onPress={() => setStep('email')} />
          </>
        )}

        {error ? (
          <Text style={[typography.footnote, { color: c.red, textAlign: 'center', marginTop: space(3) }]}>{error}</Text>
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
  input: { borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(4), fontSize: 17 },
  code: { textAlign: 'center', letterSpacing: 8, fontSize: 24 },
});
