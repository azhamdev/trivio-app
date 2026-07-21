import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceiptParseResult } from '@/ai/receiptOcr';
import Button from '@/components/Button';
import CategoryPill from '@/components/CategoryPill';
import FadeSlideIn from '@/components/FadeSlideIn';
import Input from '@/components/Input';
import ReceiptScanButton from '@/components/ReceiptScanButton';
import ScreenHeader from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { CATEGORIES } from '@/data/categories';
import { colors, type, USE_NATIVE_DRIVER } from '@/theme/theme';
import { CategoryId } from '@/types';
import { digitsOnly, formatAmountInput, formatIDR } from '@/utils/format';
import { personalBudgetStats } from '@/utils/stats';
import { isTripClosed } from '@/utils/trip';

export default function AddPersonalExpenseScreen() {
  const router = useRouter();
  const { budgetId } = useLocalSearchParams<{ budgetId: string }>();
  const { getPersonalBudget, addPersonalExpense } = useApp();
  const insets = useSafeAreaInsets();

  const budget = getPersonalBudget(budgetId);

  const [amount, setAmount] = useState(''); // raw digits
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(budget?.categoryId ?? null);
  const [note, setNote] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;

  if (!budget) return null;

  // Defensive: the FAB is hidden on a closed budget, but block deep links too.
  if (isTripClosed(budget)) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Add expense" subtitle={budget.name} />
        <View style={styles.closedWrap}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.faint} />
          <Text style={styles.closedTitle}>This budget is closed</Text>
          <Text style={styles.closedText}>
            Its ledger is locked, so no expenses can be added.
          </Text>
          <Button title="Back to budget" variant="ghost" onPress={() => router.back()} style={styles.closedBtn} />
        </View>
      </View>
    );
  }

  const stats = personalBudgetStats(budget);
  const valid = Number(amount) > 0 && title.trim().length >= 2 && !!categoryId;

  const handleAmount = (t: string) => {
    setAmount(digitsOnly(t));
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.04, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  };

  // OCR draft → fill the same local state the user edits by hand. Never submits.
  const applyReceipt = (r: ReceiptParseResult) => {
    setAmount(String(r.amount));
    setTitle(r.title);
    setCategoryId(r.categoryId);
    if (r.note) setNote(r.note);
  };

  const save = () => {
    if (!valid || !categoryId) return;
    addPersonalExpense(budget.id, { title, amount: Number(amount), categoryId, note });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Add expense" subtitle={budget.name} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <ReceiptScanButton onParsed={applyReceipt} style={styles.scan} />
        </FadeSlideIn>

        <FadeSlideIn>
          <View style={styles.amountBlock}>
            <Text style={type.overline}>Amount (IDR)</Text>
            <Animated.View style={[styles.amountRow, { transform: [{ scale: pulse }] }]}>
              <Text style={styles.amountPrefix}>Rp</Text>
              <TextInput
                style={styles.amountInput}
                value={formatAmountInput(amount)}
                onChangeText={handleAmount}
                placeholder="0"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                autoFocus
              />
            </Animated.View>
            <Text style={type.caption}>
              {stats.remaining >= 0
                ? `${formatIDR(stats.remaining)} left in this budget`
                : `Budget already over by ${formatIDR(-stats.remaining)}`}
            </Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={70}>
          <Input
            label="Description"
            value={title}
            onChangeText={setTitle}
            placeholder="Grocery run"
            containerStyle={styles.field}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={130}>
          <Text style={styles.groupLabel}>Category</Text>
          <View style={styles.grid}>
            {CATEGORIES.map((c) => (
              <CategoryPill
                key={c.id}
                category={c}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={190}>
          <Input
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Add a note"
            containerStyle={styles.field}
          />
          <Button title="Save expense" onPress={save} disabled={!valid} style={styles.save} />
        </FadeSlideIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  scan: { marginTop: 8, marginBottom: 8 },
  amountBlock: { alignItems: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountPrefix: { fontSize: 22, fontWeight: '700', color: colors.slate },
  amountInput: {
    ...type.heroInput,
    minWidth: 80,
    textAlign: 'center',
    ...Platform.select({ web: { outlineStyle: 'none' } as object }),
  },
  field: { marginBottom: 18 },
  groupLabel: { ...type.label, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  save: { marginTop: 4 },
  closedWrap: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 8 },
  closedTitle: { ...type.subtitle, marginTop: 12 },
  closedText: { ...type.body, color: colors.slate, textAlign: 'center' },
  closedBtn: { marginTop: 18, alignSelf: 'stretch' },
});
