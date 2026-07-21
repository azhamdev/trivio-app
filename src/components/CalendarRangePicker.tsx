import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import { colors, radius, type } from '@/theme/theme';
import {
  addDays,
  buildMonthGrid,
  daysBetweenInclusive,
  formatDateRange,
  isSameDay,
  monthTitle,
  startOfDay,
  todayStart,
  WEEKDAY_SHORT,
} from '@/utils/dates';

type Props = {
  visible: boolean;
  initialStart: number | null;
  initialEnd: number | null;
  onCancel: () => void;
  onConfirm: (start: number, end: number) => void;
};

type Preset = { label: string; days: number };
const PRESETS: Preset[] = [
  { label: '3 days', days: 3 },
  { label: '5 days', days: 5 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
];

// Range calendar in a bottom sheet: tap a start day, then an end day. Tapping
// again (or before the current start) restarts the selection. Booking-app feel.
export default function CalendarRangePicker({
  visible,
  initialStart,
  initialEnd,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const today = todayStart();

  const [start, setStart] = useState<number | null>(initialStart);
  const [end, setEnd] = useState<number | null>(initialEnd);
  const [cursor, setCursor] = useState(() => {
    const base = new Date(initialStart ?? today);
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  // Re-seed internal state each time the sheet is opened, so it reflects the
  // dates currently on the form rather than a stale prior selection.
  useEffect(() => {
    if (!visible) return;
    setStart(initialStart);
    setEnd(initialEnd);
    const base = new Date(initialStart ?? today);
    setCursor({ year: base.getFullYear(), month: base.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const shiftMonth = (dir: -1 | 1) => {
    setCursor((c) => {
      const m = c.month + dir;
      if (m < 0) return { year: c.year - 1, month: 11 };
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  };

  const pickDay = (ts: number) => {
    // No start yet, or a full range already chosen → begin a new range.
    if (start == null || (start != null && end != null)) {
      setStart(ts);
      setEnd(null);
      return;
    }
    // Second tap: before start restarts; on/after start closes the range.
    if (ts < start) setStart(ts);
    else setEnd(ts);
  };

  const applyPreset = (days: number) => {
    setStart(today);
    setEnd(addDays(today, days - 1));
    setCursor({ year: new Date(today).getFullYear(), month: new Date(today).getMonth() });
  };

  const dayCount = start != null && end != null ? daysBetweenInclusive(start, end) : 0;
  const ready = start != null && end != null;

  const summary = ready
    ? `${formatDateRange(start!, end!)} · ${dayCount} day${dayCount === 1 ? '' : 's'}`
    : start != null
      ? 'Now pick the end date'
      : 'Pick your start date';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={type.subtitle}>Trip dates</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.slate} />
            </Pressable>
          </View>
          <Text style={styles.summary}>{summary}</Text>

          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <PressableScale key={p.label} onPress={() => applyPreset(p.days)} style={styles.preset}>
                <Text style={styles.presetText}>{p.label}</Text>
              </PressableScale>
            ))}
          </View>

          <View style={styles.monthNav}>
            <PressableScale onPress={() => shiftMonth(-1)} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.ink} />
            </PressableScale>
            <Text style={styles.monthLabel}>{monthTitle(cursor.year, cursor.month)}</Text>
            <PressableScale onPress={() => shiftMonth(1)} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.ink} />
            </PressableScale>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_SHORT.map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map((ts, i) => {
              if (ts == null) return <View key={`b${i}`} style={styles.cell} />;
              const isStart = start != null && isSameDay(ts, start);
              const isEnd = end != null && isSameDay(ts, end);
              const inRange = start != null && end != null && ts > start && ts < end;
              const isEndpoint = isStart || isEnd;
              const isToday = isSameDay(ts, today);
              const spansRange = start != null && end != null && !isSameDay(start, end);

              return (
                <Pressable key={ts} style={styles.cell} onPress={() => pickDay(ts)}>
                  {/* Continuous range band behind the day number */}
                  {(inRange || (isEndpoint && spansRange)) && (
                    <View
                      style={[
                        styles.band,
                        isStart && styles.bandStart,
                        isEnd && styles.bandEnd,
                      ]}
                    />
                  )}
                  <View style={[styles.dayInner, isEndpoint && styles.dayEndpoint]}>
                    <Text
                      style={[
                        styles.dayText,
                        isToday && styles.dayToday,
                        isEndpoint && styles.dayEndpointText,
                      ]}>
                      {new Date(ts).getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Button
            title={ready ? `Apply · ${dayCount} day${dayCount === 1 ? '' : 's'}` : 'Apply'}
            onPress={() => ready && onConfirm(startOfDay(start!), startOfDay(end!))}
            disabled={!ready}
            style={styles.apply}
          />
        </View>
      </View>
    </Modal>
  );
}

const CELL = `${100 / 7}%`;

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,34,57,0.4)' },
  backdropFill: StyleSheet.absoluteFill,
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { ...type.label, color: colors.primary, marginTop: 6, marginBottom: 14 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  presetText: { fontSize: 12.5, fontWeight: '700', color: colors.primaryDark },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { ...type.subtitle },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: CELL, textAlign: 'center', ...type.caption, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: CELL,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    right: 0,
    backgroundColor: colors.primarySoft,
  },
  bandStart: { left: '50%' },
  bandEnd: { right: '50%' },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayEndpoint: { backgroundColor: colors.primary },
  dayText: { fontSize: 14.5, color: colors.ink, fontWeight: '500' },
  dayToday: { color: colors.primary, fontWeight: '800' },
  dayEndpointText: { color: '#FFFFFF', fontWeight: '700' },
  apply: { marginTop: 16 },
});
