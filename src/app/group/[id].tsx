import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  ScrollView as RNScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ExpenseRow from '@/components/ExpenseRow';
import FadeSlideIn from '@/components/FadeSlideIn';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import { useApp } from '@/context/AppContext';
import { colors, radius, shadow, type, USE_NATIVE_DRIVER } from '@/theme/theme';
import { formatDateRange, formatDateShort } from '@/utils/dates';
import { formatIDR, formatIDRCompact } from '@/utils/format';
import { groupExpensesByDay, groupStats } from '@/utils/stats';
import { canReopen, closedLabel, isTripClosed, tripDayInfo } from '@/utils/trip';

const COVER_HEIGHT = 280;
const AnimatedCover = Animated.createAnimatedComponent(Image);

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroup, user, deleteExpense, closeTrip, reopenTrip } = useApp();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const group = getGroup(id);
  if (!group || !user) return null;

  const stats = groupStats(group);
  const sections = groupExpensesByDay(group.expenses);
  const closed = isTripClosed(group);
  const reopenable = canReopen(group);
  const dayInfo = tripDayInfo(group);

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join "${group.name}" on Trivio — open the app, choose "Join with code", and enter ${group.code}.`,
      });
    } catch {}
  };

  // Parallax: cover drifts at half scroll speed and stretches on pull-down.
  const coverTranslate = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0, COVER_HEIGHT],
    outputRange: [-COVER_HEIGHT / 2, 0, COVER_HEIGHT * 0.4],
  });
  const coverScale = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0],
    outputRange: [1.5, 1],
    extrapolateRight: 'clamp',
  });

  return (
    <View style={styles.flex}>
      <AnimatedCover
        source={{ uri: group.coverUrl }}
        contentFit="cover"
        transition={300}
        style={[styles.cover, { transform: [{ translateY: coverTranslate }, { scale: coverScale }] }]}
      />

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: USE_NATIVE_DRIVER,
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={styles.coverSpacer} />
        <View style={styles.sheet}>
          <FadeSlideIn>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <Text style={[type.display, styles.title]}>{group.name}</Text>
              {closed ? (
                <View style={styles.statusChip}>
                  <Ionicons name="lock-closed" size={12} color={colors.slate} />
                  <Text style={styles.statusChipText}>{closedLabel(group)}</Text>
                </View>
              ) : (
                <View style={[styles.statusChip, styles.statusChipActive]}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.statusChipText, styles.statusChipTextActive]}>
                    {dayInfo.label}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.slate} />
              <Text style={styles.metaText}>{group.destination}</Text>
              <View style={styles.metaDot} />
              <Ionicons name="calendar-outline" size={14} color={colors.slate} />
              <Text style={styles.metaText}>{formatDateRange(group.startDate, group.endDate)}</Text>
            </View>
            <PressableScale onPress={copyCode} style={styles.codePill}>
              <Ionicons name="key-outline" size={15} color={colors.primaryDark} />
              <Text style={styles.codeText}>{group.code}</Text>
              <Text style={styles.codeHint}>{copied ? 'Copied!' : 'Tap to copy · share to invite'}</Text>
            </PressableScale>
          </FadeSlideIn>

          {closed ? (
            <FadeSlideIn delay={40}>
              <View style={styles.closedBanner}>
                <View style={styles.closedIcon}>
                  <Ionicons name="lock-closed" size={18} color={colors.slate} />
                </View>
                <View style={styles.closedBody}>
                  <Text style={styles.closedTitle}>
                    {group.closedReason === 'ended' ? 'This trip has ended' : 'This trip is closed'}
                  </Text>
                  <Text style={styles.closedText}>
                    Expenses are locked to keep the final split settled.
                    {reopenable ? ' Reopen it to add more.' : ''}
                  </Text>
                  {reopenable ? (
                    <Button
                      title="Reopen trip"
                      icon="refresh-outline"
                      variant="ghost"
                      small
                      onPress={() => reopenTrip(group.id)}
                      style={styles.reopenBtn}
                    />
                  ) : null}
                </View>
              </View>
            </FadeSlideIn>
          ) : null}

          <FadeSlideIn delay={80}>
            <View style={[styles.card, shadow.card]}>
              <Text style={type.overline}>Budget</Text>
              <View style={styles.budgetRow}>
                <Text style={styles.spentBig}>{formatIDR(stats.spent)}</Text>
                <Text style={styles.ofBudget}>of {formatIDR(group.budget)}</Text>
              </View>
              <ProgressBar value={stats.pctUsed} style={styles.budgetBar} />
              <View style={styles.budgetFooter}>
                {stats.remaining >= 0 ? (
                  <Text style={styles.remainOk}>{formatIDR(stats.remaining)} left</Text>
                ) : (
                  <Text style={styles.remainOver}>Over by {formatIDR(-stats.remaining)}</Text>
                )}
                <Text style={type.caption}>
                  ≈ {formatIDRCompact(stats.perPersonBudget)} /person budget
                </Text>
              </View>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={140}>
            <Text style={styles.sectionTitle}>Members · {group.members.length}</Text>
            <RNScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersRow}>
              {stats.byMember.map(({ member, paid }) => (
                <View key={member.id} style={styles.memberChip}>
                  <Avatar name={member.name} size={44} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.id === user.id ? 'You' : member.name.split(' ')[0]}
                  </Text>
                  <Text style={type.caption}>{paid > 0 ? formatIDRCompact(paid) : '—'}</Text>
                </View>
              ))}
              <PressableScale onPress={shareCode} style={styles.memberChip}>
                <View style={styles.inviteCircle}>
                  <Ionicons name="add" size={20} color={colors.primary} />
                </View>
                <Text style={styles.inviteLabel}>Invite</Text>
              </PressableScale>
            </RNScrollView>
          </FadeSlideIn>

          {stats.byCategory.length > 0 ? (
            <FadeSlideIn delay={200}>
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
                        animateDelay={250 + i * 120}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </FadeSlideIn>
          ) : null}

          <FadeSlideIn delay={260}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            {sections.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No expenses yet"
                message={
                  closed
                    ? 'This trip closed without any expenses logged.'
                    : 'Tap + to log the first one — meals, rides, tickets, anything the group pays for.'
                }
              />
            ) : (
              sections.map((section) => (
                <View key={section.key}>
                  <Text style={styles.dayLabel}>{section.label}</Text>
                  {section.items.map((exp) => (
                    <ExpenseRow
                      key={exp.id}
                      expense={exp}
                      group={group}
                      currentUserId={user.id}
                      onDelete={() => deleteExpense(group.id, exp.id)}
                    />
                  ))}
                </View>
              ))
            )}
          </FadeSlideIn>

          {!closed ? (
            <FadeSlideIn delay={320}>
              <Button
                title="Close this trip"
                icon="flag-outline"
                variant="ghost"
                onPress={() => setConfirmClose(true)}
                style={styles.closeTripBtn}
              />
              <Text style={styles.closeHint}>
                Closing locks the ledger once everyone&apos;s settled up. Trivio also closes it
                automatically after {formatDateShort(group.endDate)}.
              </Text>
            </FadeSlideIn>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.roundBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </PressableScale>
        <PressableScale onPress={shareCode} style={styles.roundBtn}>
          <Ionicons name="share-outline" size={20} color={colors.ink} />
        </PressableScale>
      </View>

      {!closed ? (
        <PressableScale
          onPress={() => router.push({ pathname: '/add-expense', params: { groupId: group.id } })}
          style={[styles.fab, shadow.fab, { bottom: insets.bottom + 24 }]}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </PressableScale>
      ) : null}

      <Modal visible={confirmClose} transparent animationType="fade" onRequestClose={() => setConfirmClose(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmClose(false)} />
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <Ionicons name="flag" size={22} color={colors.primary} />
            </View>
            <Text style={styles.dialogTitle}>Close {group.name}?</Text>
            <Text style={styles.dialogBody}>
              No new expenses can be added after closing. You can reopen it later as long as the trip
              dates haven&apos;t passed.
            </Text>
            <Button
              title="Close trip"
              onPress={() => {
                closeTrip(group.id);
                setConfirmClose(false);
              }}
            />
            <Button
              title="Keep it open"
              variant="ghost"
              onPress={() => setConfirmClose(false)}
              style={styles.dialogCancel}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COVER_HEIGHT,
    backgroundColor: colors.primarySoft,
  },
  coverSpacer: { height: COVER_HEIGHT - 60 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    minHeight: 620,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 18,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexShrink: 1 },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  metaText: { fontSize: 13.5, color: colors.slate, fontWeight: '500' },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.faint,
    marginHorizontal: 4,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 14,
  },
  codeText: { fontSize: 14, fontWeight: '800', color: colors.primaryDark, letterSpacing: 2 },
  codeHint: { fontSize: 11.5, color: colors.primary, fontWeight: '600' },
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
  closedText: { ...type.caption, lineHeight: 18, marginTop: 3 },
  reopenBtn: { alignSelf: 'flex-start', marginTop: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginTop: 16 },
  budgetRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  spentBig: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  ofBudget: { ...type.caption, fontSize: 13.5, marginBottom: 4 },
  budgetBar: { marginTop: 14 },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  remainOk: { fontSize: 13.5, fontWeight: '700', color: colors.success },
  remainOver: { fontSize: 13.5, fontWeight: '700', color: colors.danger },
  sectionTitle: { ...type.subtitle, marginTop: 26, marginBottom: 12 },
  membersRow: { gap: 16, paddingRight: 8 },
  memberChip: { alignItems: 'center', gap: 4, width: 60 },
  memberName: { fontSize: 12.5, fontWeight: '600', color: colors.ink, marginTop: 2 },
  inviteCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteLabel: { fontSize: 12.5, fontWeight: '600', color: colors.primary, marginTop: 2 },
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
  dayLabel: { ...type.overline, marginTop: 14, marginBottom: 10 },
  closeTripBtn: { marginTop: 28 },
  closeHint: { ...type.caption, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: { ...type.title, fontSize: 19, marginBottom: 8 },
  dialogBody: { ...type.body, color: colors.slate, marginBottom: 18 },
  dialogCancel: { marginTop: 8 },
});
