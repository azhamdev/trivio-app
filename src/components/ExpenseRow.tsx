import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { categoryById } from '@/data/categories';
import { colors, radius, type } from '@/theme/theme';
import { Expense, Group } from '@/types';
import { firstName, formatIDR, formatTime } from '@/utils/format';

type Props = {
  expense: Expense;
  group: Group;
  currentUserId: string;
  onDelete: () => void;
};

// Long-press a row to reveal an inline delete confirmation (auto-dismisses).
export default function ExpenseRow({ expense, group, currentUserId, onDelete }: Props) {
  const cat = categoryById(expense.categoryId);
  const payer = group.members.find((m) => m.id === expense.paidById);
  const payerLabel = payer ? (payer.id === currentUserId ? 'you' : firstName(payer.name)) : 'someone';
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 2600);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <PressableScale
      scaleTo={0.98}
      onLongPress={() => setConfirming(true)}
      onPress={() => confirming && setConfirming(false)}
      style={styles.row}>
      <View style={[styles.iconTile, { backgroundColor: cat.tint }]}>
        <Ionicons name={cat.icon} size={18} color={cat.color} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          Paid by {payerLabel} · {formatTime(expense.createdAt)}
          {expense.note ? ` · ${expense.note}` : ''}
        </Text>
      </View>
      {confirming ? (
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      ) : (
        <Text style={styles.amount}>{formatIDR(expense.amount)}</Text>
      )}
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
  amount: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});
