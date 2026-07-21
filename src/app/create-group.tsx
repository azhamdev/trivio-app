import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import CalendarRangePicker from '@/components/CalendarRangePicker';
import FadeSlideIn from '@/components/FadeSlideIn';
import Input from '@/components/Input';
import PressableScale from '@/components/PressableScale';
import ScreenHeader from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { colors, radius, type, USE_NATIVE_DRIVER } from '@/theme/theme';
import { Group } from '@/types';
import { daysBetweenInclusive, formatDateRange } from '@/utils/dates';
import { digitsOnly, formatAmountInput } from '@/utils/format';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { createGroup } = useApp();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<number | null>(null);
  const [budget, setBudget] = useState(''); // raw digits
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Group | null>(null);
  const [copied, setCopied] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  const dayCount = startDate != null && endDate != null ? daysBetweenInclusive(startDate, endDate) : 0;

  const submit = () => {
    setError(null);
    const b = Number(budget);
    if (name.trim().length < 2) return setError('Give the trip a name — e.g. "Bali Getaway".');
    if (destination.trim().length < 2) return setError('Where are you going? Add a destination.');
    if (startDate == null || endDate == null) return setError('Pick your trip start and end dates.');
    if (!b) return setError('Set a group budget so Trivio can track your pace.');
    const res = createGroup({ name, destination, startDate, endDate, budget: b });
    if (!res.ok) return setError(res.error);
    setCreated(res.value);
    Animated.spring(pop, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 10,
      bounciness: 14,
    }).start();
  };

  const copyCode = async () => {
    if (!created) return;
    try {
      await Clipboard.setStringAsync(created.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const shareCode = async () => {
    if (!created) return;
    try {
      await Share.share({
        message: `Join "${created.name}" on Trivio — open the app, choose "Join with code", and enter ${created.code}.`,
      });
    } catch {}
  };

  if (created) {
    return (
      <View style={[styles.flex, styles.successWrap, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.checkCircle, { opacity: pop, transform: [{ scale: pop }] }]}>
          <Ionicons name="checkmark" size={44} color="#FFFFFF" />
        </Animated.View>
        <FadeSlideIn delay={120}>
          <Text style={styles.successTitle}>{created.name} is ready</Text>
          <Text style={styles.successBody}>
            Share this code so friends can join — every expense lands in one place.
          </Text>
        </FadeSlideIn>
        <FadeSlideIn delay={220} style={styles.fullWidth}>
          <PressableScale onPress={copyCode} style={styles.codeBox}>
            <Text style={styles.codeText}>{created.code}</Text>
            <Text style={styles.copyHint}>{copied ? 'Copied to clipboard' : 'Tap to copy'}</Text>
          </PressableScale>
          <Button title="Share invite code" icon="share-outline" onPress={shareCode} />
          <Button
            title="Open the trip"
            variant="ghost"
            onPress={() => router.replace({ pathname: '/group/[id]', params: { id: created.id } })}
            style={styles.secondaryBtn}
          />
        </FadeSlideIn>
      </View>
    );
  }

  const datesChosen = startDate != null && endDate != null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Create a trip" subtitle="One budget, one code, whole squad" />
      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
        <FadeSlideIn>
          <Input
            label="Trip name"
            value={name}
            onChangeText={setName}
            placeholder="Bali Getaway"
            containerStyle={styles.field}
          />
          <Input
            label="Destination"
            value={destination}
            onChangeText={setDestination}
            placeholder="Bali, Indonesia"
            containerStyle={styles.field}
          />

          <Text style={styles.fieldLabel}>Trip dates</Text>
          <PressableScale
            onPress={() => setPickerOpen(true)}
            style={[styles.dateField, datesChosen && styles.dateFieldFilled]}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={datesChosen ? colors.primary : colors.faint}
            />
            <Text style={[styles.datePlaceholder, datesChosen && styles.dateValue]}>
              {datesChosen ? formatDateRange(startDate!, endDate!) : 'Add start & end dates'}
            </Text>
            {datesChosen ? (
              <View style={styles.daysBadge}>
                <Text style={styles.daysBadgeText}>
                  {dayCount} day{dayCount === 1 ? '' : 's'}
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            )}
          </PressableScale>
          <Text style={styles.helper}>Trivio estimates the trip length from these dates.</Text>

          <Input
            label="Group budget"
            value={formatAmountInput(budget)}
            onChangeText={(t) => setBudget(digitsOnly(t))}
            placeholder="15.000.000"
            keyboardType="number-pad"
            left={<Text style={styles.prefix}>Rp</Text>}
            containerStyle={styles.field}
          />
          <Text style={styles.helper}>
            The budget covers the whole group. Trivio tracks spending against it and warns you
            before it runs out.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Create trip group" onPress={submit} />
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
  daysBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  daysBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  prefix: { fontSize: 15, fontWeight: '700', color: colors.slate },
  helper: { ...type.caption, lineHeight: 18, marginTop: 8, marginBottom: 16 },
  error: { fontSize: 13, color: colors.danger, marginBottom: 12 },
  successWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: { ...type.display, fontSize: 24, textAlign: 'center' },
  successBody: {
    ...type.body,
    color: colors.slate,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  fullWidth: { alignSelf: 'stretch' },
  codeBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 28,
    marginBottom: 20,
    gap: 6,
  },
  codeText: { fontSize: 34, fontWeight: '800', color: colors.primaryDark, letterSpacing: 10 },
  copyHint: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  secondaryBtn: { marginTop: 10 },
});
