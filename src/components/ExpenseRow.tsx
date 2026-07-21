import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { categoryById } from '@/data/categories';
import { colors, radius, type } from '@/theme/theme';
import { Expense, PersonalExpense } from '@/types';
import { formatIDR, formatTime } from '@/utils/format';

type Props = {
  expense: Expense | PersonalExpense;
  // "Paid by X" label for a group expense; null hides that prefix entirely,
  // which is how a memberless PersonalExpense reuses this same row.
  payerLabel: string | null;
  // Provided only when the viewer may manage this entry (trip/budget creator,
  // open trip/budget). When set, tapping the row opens the manage sheet.
  onManage?: () => void;
};

export default function ExpenseRow({ expense, payerLabel, onManage }: Props) {
  const cat = categoryById(expense.categoryId);
  const manageable = !!onManage;

  return (
    <PressableScale
      scaleTo={manageable ? 0.98 : 1}
      onPress={onManage}
      disabled={!manageable}
      accessibilityRole={manageable ? 'button' : undefined}
      accessibilityLabel={`${expense.title}, ${formatIDR(expense.amount)}${payerLabel ? `, paid by ${payerLabel}` : ''}`}
      accessibilityHint={manageable ? 'Opens options to edit or delete' : undefined}
      style={styles.row}>
      <View style={[styles.iconTile, { backgroundColor: cat.tint }]}>
        <Ionicons name={cat.icon} size={18} color={cat.color} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {payerLabel ? `Paid by ${payerLabel} · ` : ''}
          {formatTime(expense.createdAt)}
          {expense.note ? ` · ${expense.note}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatIDR(expense.amount)}</Text>
        {manageable ? (
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.faint} style={styles.dots} />
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    marginBottom: 10,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  title: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  dots: { marginRight: -2 },
});
