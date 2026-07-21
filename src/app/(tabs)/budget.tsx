import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BudgetCard from '@/components/BudgetCard';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import FadeSlideIn from '@/components/FadeSlideIn';
import { useApp } from '@/context/AppContext';
import { type } from '@/theme/theme';
import { useThemeColors } from '@/theme/ThemeContext';

export default function BudgetScreen() {
  const router = useRouter();
  const { myBudgets } = useApp();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const openBudget = (id: string) => router.push({ pathname: '/budget/[id]', params: { id } });

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <FadeSlideIn>
        <Text style={[type.display, { color: colors.ink }]}>Your budgets</Text>
        <Text style={[styles.headerCaption, { color: colors.faint }]}>
          Track your own spending, separate from group trips.
        </Text>
      </FadeSlideIn>

      <FadeSlideIn delay={80}>
        <Button
          title="New budget"
          icon="add"
          onPress={() => router.push('/create-personal-budget')}
          style={styles.actionBtn}
        />
      </FadeSlideIn>

      <FadeSlideIn delay={140}>
        <Text style={[styles.sectionLabel, { color: colors.slate }]}>Personal budgets</Text>
      </FadeSlideIn>

      {myBudgets.length === 0 ? (
        <FadeSlideIn delay={200}>
          <EmptyState
            icon="wallet-outline"
            title="No budgets yet"
            message="Create a personal budget for a week, a month, or a category, and Trivio will track your pace."
            actionTitle="Create your first budget"
            onAction={() => router.push('/create-personal-budget')}
          />
        </FadeSlideIn>
      ) : (
        myBudgets.map((budget, i) => (
          <FadeSlideIn key={budget.id} delay={200 + i * 80}>
            <BudgetCard budget={budget} onPress={() => openBudget(budget.id)} />
          </FadeSlideIn>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  headerCaption: { fontSize: 13.5, marginTop: 4 },
  actionBtn: { marginTop: 24 },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 32,
    marginBottom: 14,
  },
});
