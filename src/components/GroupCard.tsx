import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import Avatar from '@/components/Avatar';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import { colors, radius, shadow, type } from '@/theme/theme';
import { Group } from '@/types';
import { formatDateRangeShort } from '@/utils/dates';
import { formatIDRCompact } from '@/utils/format';
import { groupStats } from '@/utils/stats';
import { closedLabel, isTripClosed } from '@/utils/trip';

type Props = { group: Group; onPress: () => void; style?: StyleProp<ViewStyle> };

export default function GroupCard({ group, onPress, style }: Props) {
  const stats = groupStats(group);
  const extraMembers = group.members.length - 3;
  const closed = isTripClosed(group);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${group.destination}`}
      style={[styles.card, shadow.card, style]}>
      <View style={closed ? styles.dimmed : undefined}>
        <Image source={{ uri: group.coverUrl }} style={styles.cover} contentFit="cover" transition={250} />
      </View>
      <View style={styles.daysChip}>
        <Ionicons name="calendar-outline" size={12} color={colors.ink} />
        <Text style={styles.daysText}>{formatDateRangeShort(group.startDate, group.endDate)}</Text>
      </View>
      {closed ? (
        <View style={styles.closedChip}>
          <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
          <Text style={styles.closedChipText}>{closedLabel(group)}</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={styles.destRow}>
          <Ionicons name="location-outline" size={13} color={colors.slate} />
          <Text style={styles.dest} numberOfLines={1}>
            {group.destination}
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.avatars}>
            {group.members.slice(0, 3).map((m, i) => (
              <Avatar key={m.id} name={m.name} size={26} style={[styles.stackAvatar, i > 0 && styles.overlap]} />
            ))}
            {extraMembers > 0 ? (
              <View style={[styles.more, styles.overlap]}>
                <Text style={styles.moreText}>+{extraMembers}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.spendText}>
            <Text style={styles.spendStrong}>{formatIDRCompact(stats.spent)}</Text>
            {'  of '}
            {formatIDRCompact(group.budget)}
          </Text>
        </View>
        <ProgressBar value={stats.pctUsed} height={6} style={styles.progress} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cover: { width: '100%', height: 132, backgroundColor: colors.primarySoft },
  dimmed: { opacity: 0.55 },
  closedChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(11,34,57,0.72)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  closedChipText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  daysChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  daysText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  body: { padding: 14 },
  name: { ...type.subtitle, fontSize: 17 },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dest: { ...type.caption, color: colors.slate, flexShrink: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { borderWidth: 2, borderColor: colors.card },
  overlap: { marginLeft: -8 },
  more: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.line,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontSize: 10, fontWeight: '700', color: colors.slate },
  spendText: { ...type.caption },
  spendStrong: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  progress: { marginTop: 10 },
});
