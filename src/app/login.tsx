import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import FadeSlideIn from '@/components/FadeSlideIn';
import Input from '@/components/Input';
import PressableScale from '@/components/PressableScale';
import { useApp } from '@/context/AppContext';
import { colors, radius, type } from '@/theme/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const res = await login({ email, password });
    setSubmitting(false);
    if (!res.ok) {
      // Unconfirmed account: send them to the "check your inbox" screen instead
      // of dead-ending on an error.
      if (res.needsConfirmation) {
        router.push({ pathname: '/confirm-email', params: { email: email.trim().toLowerCase() } });
        return;
      }
      setError(res.error);
    }
    // On success the auth guard swaps the stack to the main app.
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <View style={styles.logoBlock}>
            <View style={styles.logoSquare}>
              <Ionicons name="airplane" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.wordmark}>Trivio</Text>
            <Text style={styles.tagline}>
              Track group trip spending together — no spreadsheets, no awkward IOUs.
            </Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            containerStyle={styles.field}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secure
            containerStyle={styles.field}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Log in" onPress={submit} loading={submitting} style={styles.submit} />
        </FadeSlideIn>

        <FadeSlideIn delay={180}>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to Trivio?</Text>
            <PressableScale onPress={() => router.push('/register')} hitSlop={8}>
              <Text style={styles.link}>Create an account</Text>
            </PressableScale>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logoSquare: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...type.display, marginTop: 14 },
  tagline: {
    ...type.body,
    color: colors.slate,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  field: { marginBottom: 16 },
  error: { fontSize: 13, color: colors.danger, marginBottom: 12 },
  submit: { marginTop: 4 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerText: { ...type.caption, fontSize: 13.5 },
  link: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
});
