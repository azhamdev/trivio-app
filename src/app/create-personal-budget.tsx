import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import CalendarRangePicker from '@/components/CalendarRangePicker';
import CategoryPill from '@/components/CategoryPill';
import FadeSlideIn from '@/components/FadeSlideIn';
import Input from '@/components/Input';
import PressableScale from '@/components/PressableScale';
import ScreenHeader from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { CATEGORIES } from '@/data/categories';
import { colors, radius, type } from '@/theme/theme';
import { CategoryId } from '@/types';
import { endOfMonth, endOfWeek, formatDateRange, startOfMonth, startOfWeek } from '@/utils/dates';
import { digitsOnly, formatAmountInput } from '@/utils/format';

export default function CreatePersonalBudgetScreen() {
  const router = useRouter();
  const { createPersonalBudget } = useApp();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<number | null>(null);
  const [amount, setAmount] = useState(''); // raw digits
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datesChosen = startDate != null && endDate != null;

  const applyThisWeek = () => {
    setStartDate(startOfWeek());
    setEndDate(endOfWeek());
  };
  const applyThisMonth = () => {
    setStartDate(startOfMonth());
    setEndDate(endOfMonth());
  };

  const submit = async () => {
    setError(null);
    const b = Number(amount);
    if (name.trim().length < 2) return setError('Give the budget a name — e.g. "Groceries" or "July".');
    if (startDate == null || endDate == null) return setError('Pick the budget period.');
    if (!b) return setError('Set an amount so Trivio can track your pace.');
    const res = await createPersonalBudget({ name, amount: b, startDate, endDate, categoryId });
    if (!res.ok) return setError(res.error);
    router.replace({ pathname: '/budget/[id]', params: { id: res.value.id } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="New budget" subtitle="Track your own spending" />
      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <Input
            label="Budget name"
            value={name}
            onChangeText={setName}
            placeholder="Groceries, July spending..."
            containerStyle={styles.field}
          />

          <Text style={styles.fieldLabel}>Budget period</Text>
          <View style={styles.presetRow}>
            <PressableScale onPress={applyThisWeek} style={styles.preset}>
              <Text style={styles.presetText}>This week</Text>
            </PressableScale>
            <PressableScale onPress={applyThisMonth} style={styles.preset}>
              <Text style={styles.presetText}>This month</Text>
            </PressableScale>
          </View>
          <PressableScale
            onPress={() => setPickerOpen(true)}
            style={[styles.dateField, datesChosen && styles.dateFieldFilled]}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={datesChosen ? colors.primary : colors.faint}
            />
            <Text style={[styles.datePlaceholder, datesChosen && styles.dateValue]}>
              {datesChosen ? formatDateRange(startDate!, endDate!) : 'Or pick a custom range'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </PressableScale>
          <Text style={styles.helper}>Pick a preset or a custom date range for this budget.</Text>

          <Input
            label="Amount"
            value={formatAmountInput(amount)}
            onChangeText={(t) => setAmount(digitsOnly(t))}
            placeholder="2.000.000"
            keyboardType="number-pad"
            left={<Text style={styles.prefix}>Rp</Text>}
            containerStyle={styles.field}
          />

          <Text style={styles.fieldLabel}>Category (optional)</Text>
          <Text style={styles.helper}>
            Scope this budget to one category, or leave it open to track everything.
          </Text>
          <View style={styles.grid}>
            {CATEGORIES.map((c) => (
              <CategoryPill
                key={c.id}
                category={c}
                selected={categoryId === c.id}
                onPress={() => setCategoryId((prev) => (prev === c.id ? null : c.id))}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Create budget" onPress={submit} />
        </FadeSlideIn>
      </ScrollView>

      <CalendarRangePicker
        visible={pickerOpen}
        initialStart={startDate}
        initialEnd={endDate}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(s, e) => {
          setStartDate(s);
          setEndDate(e);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  form: { paddingHorizontal: 20, paddingTop: 8 },
  field: { marginBottom: 16 },
  fieldLabel: { ...type.label, marginBottom: 7 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  presetText: { fontSize: 12.5, fontWeight: '700', color: colors.primaryDark },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  dateFieldFilled: { borderColor: colors.primary },
  datePlaceholder: { flex: 1, fontSize: 15, color: colors.faint },
  dateValue: { color: colors.ink, fontWeight: '600' },
  prefix: { fontSize: 15, fontWeight: '700', color: colors.slate },
  helper: { ...type.caption, lineHeight: 18, marginTop: 8, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  error: { fontSize: 13, color: colors.danger, marginBottom: 12 },
});
