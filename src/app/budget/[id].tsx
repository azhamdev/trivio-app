import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ExpenseRow from '@/components/ExpenseRow';
import FadeSlideIn from '@/components/FadeSlideIn';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import ScreenHeader from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { categoryById } from '@/data/categories';
import { radius, shadow, type } from '@/theme/theme';
import { ThemeColors, useThemeColors } from '@/theme/ThemeContext';
import { PersonalExpense } from '@/types';
import { formatDateRange } from '@/utils/dates';
import { formatIDR, formatIDRCompact } from '@/utils/format';
import { groupExpensesByDay, personalBudgetStats } from '@/utils/stats';
import { closedLabel, isTripClosed, tripDayInfo } from '@/utils/trip';

export default function BudgetDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPersonalBudget, deletePersonalExpense } = useApp();
  const insets = useSafeAreaInsets();
  const [manageTarget, setManageTarget] = useState<PersonalExpense | null>(null);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const budget = getPersonalBudget(id);
  if (!budget) return null;

  const stats = personalBudgetStats(budget);
  const sections = groupExpensesByDay(budget.expenses);
  const closed = isTripClosed(budget);
  const dayInfo = tripDayInfo(budget);
  const category = budget.categoryId ? categoryById(budget.categoryId) : null;

  const doDelete = () => {
    if (!manageTarget) return;
    deletePersonalExpense(budget.id, manageTarget.id);
    setManageTarget(null);
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title={budget.name} subtitle={formatDateRange(budget.startDate, budget.endDate)} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <FadeSlideIn>
          <View style={styles.titleRow}>
            {category ? (
              <View style={[styles.categoryChip, { backgroundColor: category.tint }]}>
                <Ionicons name={category.icon} size={13} color={category.color} />
                <Text style={[styles.categoryChipText, { color: category.color }]}>{category.label}</Text>
              </View>
            ) : null}
            {closed ? (
              <View style={styles.statusChip}>
                <Ionicons name="lock-closed" size={12} color={colors.slate} />
                <Text style={styles.statusChipText}>{closedLabel(budget)}</Text>
              </View>
            ) : (
              <View style={[styles.statusChip, styles.statusChipActive]}>
                <View style={styles.liveDot} />
                <Text style={[styles.statusChipText, styles.statusChipTextActive]}>{dayInfo.label}</Text>
              </View>
            )}
          </View>
        </FadeSlideIn>

        {closed ? (
          <FadeSlideIn delay={40}>
            <View style={styles.closedBanner}>
              <View style={styles.closedIcon}>
                <Ionicons name="lock-closed" size={18} color={colors.slate} />
              </View>
              <View style={styles.closedBody}>
                <Text style={styles.closedTitle}>
                  {budget.closedReason === 'ended' ? 'This budget has ended' : 'This budget is closed'}
                </Text>
                <Text style={styles.closedText}>
                  Its ledger is locked — start a new budget for the next period.
                </Text>
              </View>
            </View>
          </FadeSlideIn>
        ) : null}

        <FadeSlideIn delay={80}>
          <View style={[styles.card, shadow.card]}>
            <Text style={[type.overline, { color: colors.slate }]}>Budget</Text>
            <View style={styles.budgetRow}>
              <Text style={styles.spentBig}>{formatIDR(stats.spent)}</Text>
              <Text style={styles.ofBudget}>of {formatIDR(budget.amount)}</Text>
            </View>
            <ProgressBar value={stats.pctUsed} style={styles.budgetBar} />
            <View style={styles.budgetFooter}>
              {stats.remaining >= 0 ? (
                <Text style={styles.remainOk}>{formatIDR(stats.remaining)} left</Text>
              ) : (
                <Text style={styles.remainOver}>Over by {formatIDR(-stats.remaining)}</Text>
              )}
              <Text style={[type.caption, { color: colors.faint }]}>
                ≈ {formatIDRCompact(stats.dailyTarget)} /day target
              </Text>
            </View>
          </View>
        </FadeSlideIn>

        {stats.byCategory.length > 0 ? (
          <FadeSlideIn delay={140}>
            <Text style={styles.sectionTitle}>By category</Text>
            <View style={[styles.card, shadow.card]}>
              {stats.byCategory.map((x, i) => (
                <View key={x.category.id} style={[styles.catRow, i > 0 && styles.catRowBorder]}>
                  <View style={[styles.catIcon, { backgroundColor: x.category.tint }]}>
                    <Ionicons name={x.category.icon} size={16} color={x.category.color} />
                  </View>
                  <View style={styles.catBody}>
                    <View style={styles.catTop}>
                      <Text style={styles.catLabel}>{x.category.label}</Text>
                      <Text style={styles.catAmount}>{formatIDR(x.total)}</Text>
                    </View>
                    <ProgressBar
                      value={x.share}
                      height={5}
                      color={x.category.color}
                      animateDelay={180 + i * 120}
                    />
                  </View>
                </View>
              ))}
            </View>
          </FadeSlideIn>
        ) : null}

        <FadeSlideIn delay={200}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          {sections.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              message={
                closed
                  ? 'This budget closed without any expenses logged.'
                  : 'Tap + to log the first one.'
              }
            />
          ) : (
            <>
              {!closed ? (
                <Text style={styles.manageHint}>Spotted a typo? Tap any expense to delete it.</Text>
              ) : null}
              {sections.map((section) => (
                <View key={section.key}>
                  <Text style={styles.dayLabel}>{section.label}</Text>
                  {section.items.map((exp) => (
                    <ExpenseRow
                      key={exp.id}
                      expense={exp}
                      payerLabel={null}
                      onManage={!closed ? () => setManageTarget(exp) : undefined}
                    />
                  ))}
                </View>
              ))}
            </>
          )}
        </FadeSlideIn>
      </ScrollView>

      {!closed ? (
        <PressableScale
          onPress={() => router.push({ pathname: '/add-personal-expense', params: { budgetId: budget.id } })}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          style={[styles.fab, shadow.fab, { bottom: insets.bottom + 24 }]}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </PressableScale>
      ) : null}

      <Modal visible={!!manageTarget} transparent animationType="fade" onRequestClose={() => setManageTarget(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setManageTarget(null)} />
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <Ionicons name="trash" size={22} color={colors.danger} />
            </View>
            <Text style={styles.dialogTitle}>Delete {manageTarget?.title}?</Text>
            <Text style={styles.dialogBody}>This can&apos;t be undone.</Text>
            <Button title="Delete expense" variant="danger" icon="trash-outline" onPress={doDelete} />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setManageTarget(null)}
              style={styles.dialogCancel}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingTop: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    categoryChipText: { fontSize: 11.5, fontWeight: '700' },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.line,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusChipActive: { backgroundColor: colors.successSoft },
    statusChipText: { fontSize: 11.5, fontWeight: '700', color: colors.slate },
    statusChipTextActive: { color: colors.success },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
    closedBanner: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.lg,
      padding: 14,
      marginTop: 16,
    },
    closedIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closedBody: { flex: 1 },
    closedTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
    closedText: { ...type.caption, color: colors.faint, lineHeight: 18, marginTop: 3 },
    card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginTop: 16 },
    budgetRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
    spentBig: { ...type.stat, color: colors.ink },
    ofBudget: { ...type.caption, color: colors.faint, fontSize: 13.5, marginBottom: 4 },
    budgetBar: { marginTop: 14 },
    budgetFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },
    remainOk: { fontSize: 13.5, fontWeight: '700', color: colors.success },
    remainOver: { fontSize: 13.5, fontWeight: '700', color: colors.danger },
    sectionTitle: { ...type.subtitle, color: colors.ink, marginTop: 26, marginBottom: 12 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    catRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
    catIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catBody: { flex: 1, gap: 7 },
    catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catLabel: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
    catAmount: { fontSize: 13, fontWeight: '700', color: colors.slate },
    dayLabel: { ...type.overline, color: colors.slate, marginTop: 14, marginBottom: 10 },
    manageHint: { ...type.caption, color: colors.faint, marginBottom: 12 },
    fab: {
      position: 'absolute',
      right: 20,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dialogBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(11,34,57,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: 22,
      width: '100%',
      maxWidth: 360,
    },
    dialogIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    dialogTitle: { ...type.title, color: colors.ink, fontSize: 19, marginBottom: 8 },
    dialogBody: { ...type.body, color: colors.slate, marginBottom: 18 },
    dialogCancel: { marginTop: 8 },
  });
