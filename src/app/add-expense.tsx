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

import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import CategoryPill from '@/components/CategoryPill';
import FadeSlideIn from '@/components/FadeSlideIn';
import Input from '@/components/Input';
import PressableScale from '@/components/PressableScale';
import ScreenHeader from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { CATEGORIES } from '@/data/categories';
import { colors, type, USE_NATIVE_DRIVER } from '@/theme/theme';
import { CategoryId } from '@/types';
import { digitsOnly, firstName, formatAmountInput, formatIDR } from '@/utils/format';
import { groupStats } from '@/utils/stats';

export default function AddExpenseScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { getGroup, user, addExpense } = useApp();
  const insets = useSafeAreaInsets();

  const group = getGroup(groupId);
  const [amount, setAmount] = useState(''); // raw digits
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [paidById, setPaidById] = useState(user?.id ?? '');
  const [note, setNote] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;

  if (!group || !user) return null;

  const stats = groupStats(group);
  const valid = Number(amount) > 0 && title.trim().length >= 2 && !!categoryId;

  const handleAmount = (t: string) => {
    setAmount(digitsOnly(t));
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.04, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  };

  const save = () => {
    if (!valid || !categoryId) return;
    addExpense(group.id, { title, amount: Number(amount), categoryId, paidById, note });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Add expense" subtitle={group.name} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
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
                ? `${formatIDR(stats.remaining)} left in the group budget`
                : `Group budget already over by ${formatIDR(-stats.remaining)}`}
            </Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={70}>
          <Input
            label="Description"
            value={title}
            onChangeText={setTitle}
            placeholder="Seafood dinner at Jimbaran"
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
          <Text style={styles.groupLabel}>Paid by</Text>
          <View style={styles.membersWrap}>
            {group.members.map((m) => {
              const selected = paidById === m.id;
              return (
                <PressableScale
                  key={m.id}
                  onPress={() => setPaidById(m.id)}
                  style={[styles.memberChip, selected && styles.memberChipSelected]}>
                  <Avatar name={m.name} size={22} />
                  <Text style={[styles.memberChipText, selected && styles.memberChipTextSelected]}>
                    {m.id === user.id ? 'You' : firstName(m.name)}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={250}>
          <Input
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Split with everyone except Dewi"
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
  amountBlock: { alignItems: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountPrefix: { fontSize: 22, fontWeight: '700', color: colors.slate },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.ink,
    minWidth: 80,
    textAlign: 'center',
    ...Platform.select({ web: { outlineStyle: 'none' } as object }),
  },
  field: { marginBottom: 18 },
  groupLabel: { ...type.label, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  membersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  memberChipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  memberChipText: { fontSize: 13.5, fontWeight: '600', color: colors.slate },
  memberChipTextSelected: { color: colors.primaryDark },
  save: { marginTop: 4 },
});
