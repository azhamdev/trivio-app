import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import CodeInput from '@/components/CodeInput';
import FadeSlideIn from '@/components/FadeSlideIn';
import PressableScale from '@/components/PressableScale';
import { useApp } from '@/context/AppContext';
import { colors, radius, type } from '@/theme/theme';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyConfirmation, resendConfirmation } = useApp();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Tick the resend cooldown down to zero, one second at a time. The interval is
  // rescheduled each tick (cooldown is a dependency) and stops at 0, so no timer
  // lingers once the button is enabled again.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const verify = async (submitted: string) => {
    if (!email || verifying || submitted.length < CODE_LENGTH) return;
    setVerifying(true);
    setError(null);
    const res = await verifyConfirmation(email, submitted);
    setVerifying(false);
    if (!res.ok) {
      setError(res.error);
      setCode(''); // Clear so the next attempt starts clean.
    }
    // On success the auth guard swaps the stack straight to home.
  };

  const resend = async () => {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setStatus(null);
    setError(null);
    const res = await resendConfirmation(email);
    setSending(false);
    if (res.ok) {
      setStatus('Sent — check your inbox for a fresh code.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setError(res.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.primary} />
          </View>
          <Text style={[type.display, styles.title]}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we sent to{'\n'}
            <Text style={styles.email}>{email || 'your email'}</Text>
          </Text>
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <View style={styles.codeWrap}>
            <CodeInput
              value={code}
              onChangeText={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              length={CODE_LENGTH}
              autoFocus
              editable={!verifying}
              onComplete={verify}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {status && !error ? <Text style={styles.status}>{status}</Text> : null}

          <Button
            title="Verify & continue"
            onPress={() => verify(code)}
            loading={verifying}
            disabled={code.length < CODE_LENGTH}
            style={styles.verifyBtn}
          />

          <View style={styles.resendRow}>
            <Text style={styles.footerText}>Didn&apos;t get it?</Text>
            <PressableScale onPress={resend} disabled={cooldown > 0 || sending} hitSlop={8}>
              <Text style={[styles.link, (cooldown > 0 || sending) && styles.linkMuted]}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? 'Sending…' : 'Resend code'}
              </Text>
            </PressableScale>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={180}>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Wrong email?</Text>
            <PressableScale onPress={() => router.replace('/login')} hitSlop={8}>
              <Text style={styles.link}>Back to login</Text>
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
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: { textAlign: 'center' },
  subtitle: { ...type.body, color: colors.slate, textAlign: 'center', marginTop: 10 },
  email: { color: colors.ink, fontWeight: '700' },
  codeWrap: { marginTop: 36, marginBottom: 8 },
  error: { fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 8 },
  status: { fontSize: 13, color: colors.success, textAlign: 'center', marginTop: 8 },
  verifyBtn: { marginTop: 20 },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerText: { ...type.caption, fontSize: 13.5 },
  link: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  linkMuted: { color: colors.faint },
});
