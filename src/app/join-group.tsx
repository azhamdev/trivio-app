import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Button from '@/components/Button';
import FadeSlideIn from '@/components/FadeSlideIn';
import ScreenHeader from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { colors, radius, type } from '@/theme/theme';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { joinGroup } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const res = await joinGroup(code);
    if (!res.ok) return setError(res.error);
    router.replace({ pathname: '/group/[id]', params: { id: res.value.id } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Join a trip" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.lead}>
            Enter the 6-character invite code from your trip organizer.
          </Text>
        </FadeSlideIn>
        <FadeSlideIn delay={100}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC123"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Join trip" onPress={submit} disabled={code.length !== 6} />
          <Text style={styles.helper}>
            Once you join, everything the group logs shows up on your phone too — and your expenses
            count toward the shared budget.
          </Text>
        </FadeSlideIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, paddingTop: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  lead: { ...type.body, color: colors.slate, textAlign: 'center', marginBottom: 28 },
  codeInput: {
    height: 68,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 10,
    color: colors.ink,
    marginBottom: 16,
    ...Platform.select({ web: { outlineStyle: 'none' } as object }),
  },
  error: { fontSize: 13, color: colors.danger, marginBottom: 12, textAlign: 'center' },
  helper: { ...type.caption, lineHeight: 18, textAlign: 'center', marginTop: 20 },
});
