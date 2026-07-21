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
import { colors, type } from '@/theme/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const res = await register({ name, email, password });
    if (!res.ok) setError(res.error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <Text style={type.display}>Create your account</Text>
          <Text style={styles.subtitle}>
            Your group sees this name next to every expense you pay, so use the one they know.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Sinta Maharani"
            autoComplete="name"
            containerStyle={styles.field}
          />
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
            placeholder="At least 6 characters"
            secure
            containerStyle={styles.field}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Create account" onPress={submit} style={styles.submit} />
        </FadeSlideIn>

        <FadeSlideIn delay={180}>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <PressableScale onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.link}>Log in</Text>
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
  subtitle: { ...type.body, color: colors.slate, marginTop: 8, marginBottom: 32 },
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
