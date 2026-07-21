import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import FadeSlideIn from '@/components/FadeSlideIn';
import PressableScale from '@/components/PressableScale';
import { useApp } from '@/context/AppContext';
import { colors, radius, shadow, type } from '@/theme/theme';
import { ThemePreference, useTheme } from '@/theme/ThemeContext';
import { formatIDR } from '@/utils/format';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function ProfileScreen() {
  const { user, myGroups, logout } = useApp();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();

  if (!user) return null;

  const myExpenses = myGroups.flatMap((g) => g.expenses.filter((e) => e.paidById === user.id));
  const paidTotal = myExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32 }]}>
      <FadeSlideIn>
        <View style={styles.identity}>
          <Avatar name={user.name} size={76} />
          <Text style={styles.name}>{user.name}</Text>
          <Text style={type.caption}>{user.email}</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={90}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadow.card]}>
            <Text style={styles.statValue}>{myGroups.length}</Text>
            <Text style={type.caption}>{myGroups.length === 1 ? 'Trip' : 'Trips'}</Text>
          </View>
          <View style={[styles.statCard, shadow.card]}>
            <Text style={styles.statValue}>{myExpenses.length}</Text>
            <Text style={type.caption}>Expenses paid</Text>
          </View>
        </View>
        <View style={[styles.totalCard, shadow.card]}>
          <Text style={type.overline}>Total you&apos;ve paid</Text>
          <Text style={styles.totalValue}>{formatIDR(paidTotal)}</Text>
          <Text style={type.caption}>Across all your trips — the assistant knows who owes what.</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={130}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(({ value, label, icon }) => {
            const selected = preference === value;
            return (
              <PressableScale
                key={value}
                onPress={() => setPreference(value)}
                accessibilityRole="button"
                accessibilityLabel={`${label} theme`}
                accessibilityState={{ selected }}
                style={[styles.themeChip, selected && styles.themeChipActive]}>
                <Ionicons name={icon} size={16} color={selected ? '#FFFFFF' : colors.slate} />
                <Text style={[styles.themeChipText, selected && styles.themeChipTextActive]}>{label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={160}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About this build</Text>
          <Text style={styles.aboutText}>
            Trivio demo v1.0 — accounts, trips, and expenses are stored on this device. Invite
            codes work between accounts on the same phone.
          </Text>
        </View>
        <Button title="Log out" variant="danger" icon="log-out-outline" onPress={logout} />
      </FadeSlideIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  identity: { alignItems: 'center', gap: 4, marginBottom: 28 },
  name: { ...type.title, marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { ...type.stat },
  totalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    marginTop: 12,
    gap: 6,
  },
  totalValue: { ...type.stat, color: colors.primaryDark },
  sectionLabel: { ...type.overline, marginTop: 24, marginBottom: 12 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  themeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  themeChipText: { fontSize: 12.5, fontWeight: '600', color: colors.slate },
  themeChipTextActive: { color: '#FFFFFF' },
  aboutCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
    gap: 4,
  },
  aboutTitle: { fontSize: 13.5, fontWeight: '700', color: colors.primaryDark },
  aboutText: { fontSize: 13, lineHeight: 19, color: colors.primaryDark, opacity: 0.85 },
});
