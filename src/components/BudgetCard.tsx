import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import { categoryById } from '@/data/categories';
import { colors, radius, shadow, type } from '@/theme/theme';
import { PersonalBudget } from '@/types';
import { formatDateRangeShort } from '@/utils/dates';
import { formatIDRCompact } from '@/utils/format';
import { personalBudgetStats } from '@/utils/stats';
import { closedLabel, isTripClosed } from '@/utils/trip';

type Props = { budget: PersonalBudget; onPress: () => void; style?: StyleProp<ViewStyle> };

// Same visual language as GroupCard, minus the cover photo and avatar stack —
// a personal budget has no members to show.
export default function BudgetCard({ budget, onPress, style }: Props) {
  const stats = personalBudgetStats(budget);
  const closed = isTripClosed(budget);
  const category = budget.categoryId ? categoryById(budget.categoryId) : null;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${budget.name}, ${formatIDRCompact(stats.spent)} of ${formatIDRCompact(budget.amount)}`}
      style={[styles.card, shadow.card, closed && styles.dimmed, style]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: category ? category.tint : colors.primarySoft }]}>
          <Ionicons
            name={category ? category.icon : 'wallet-outline'}
            size={20}
            color={category ? category.color : colors.primary}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {budget.name}
          </Text>
          <Text style={styles.dateRange} numberOfLines={1}>
            {formatDateRangeShort(budget.startDate, budget.endDate)}
          </Text>
        </View>
        {closed ? (
          <View style={styles.closedChip}>
            <Ionicons name="lock-closed" size={11} color={colors.slate} />
            <Text style={styles.closedChipText}>{closedLabel(budget)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.spendText}>
        <Text style={styles.spendStrong}>{formatIDRCompact(stats.spent)}</Text>
        {'  of '}
        {formatIDRCompact(budget.amount)}
      </Text>
      <ProgressBar value={stats.pctUsed} height={6} style={styles.progress} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  dimmed: { opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  name: { ...type.subtitle, fontSize: 16 },
  dateRange: { ...type.caption, marginTop: 2 },
  closedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.line,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  closedChipText: { fontSize: 11, fontWeight: '700', color: colors.slate },
  spendText: { ...type.caption },
  spendStrong: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  progress: { marginTop: 10 },
});
