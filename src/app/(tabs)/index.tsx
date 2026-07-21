import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import FadeSlideIn from '@/components/FadeSlideIn';
import GroupCard from '@/components/GroupCard';
import PressableScale from '@/components/PressableScale';
import { useApp } from '@/context/AppContext';
import { type } from '@/theme/theme';
import { useThemeColors } from '@/theme/ThemeContext';
import { firstName, greetingByHour } from '@/utils/format';

export default function TripsScreen() {
  const router = useRouter();
  const { user, myGroups } = useApp();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  if (!user) return null;

  const openGroup = (id: string) =>
    router.push({ pathname: '/group/[id]', params: { id } });

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <FadeSlideIn>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[type.display, { color: colors.ink }]}>
              {greetingByHour()}, {firstName(user.name)}
            </Text>
            <Text style={[styles.headerCaption, { color: colors.faint }]}>
              Let&apos;s keep the trip on budget.
            </Text>
          </View>
          <PressableScale
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile">
            <Avatar name={user.name} size={44} />
          </PressableScale>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={80}>
        <View style={styles.actionsRow}>
          <Button
            title="New trip"
            icon="add"
            onPress={() => router.push('/create-group')}
            style={styles.actionBtn}
          />
          <Button
            title="Join with code"
            icon="enter-outline"
            variant="ghost"
            onPress={() => router.push('/join-group')}
            style={styles.actionBtn}
          />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={140}>
        <Text style={[styles.sectionLabel, { color: colors.slate }]}>Your trips</Text>
      </FadeSlideIn>

      {myGroups.length === 0 ? (
        <FadeSlideIn delay={200}>
          <EmptyState
            icon="map-outline"
            title="No trips yet"
            message="Create a trip group, set a shared budget, and invite your friends with a 6-letter code."
            actionTitle="Create your first trip"
            onAction={() => router.push('/create-group')}
          />
        </FadeSlideIn>
      ) : (
        myGroups.map((group, i) => (
          <FadeSlideIn key={group.id} delay={200 + i * 80}>
            <GroupCard group={group} onPress={() => openGroup(group.id)} />
          </FadeSlideIn>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  headerCaption: { fontSize: 13.5, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionBtn: { flex: 1 },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 32,
    marginBottom: 14,
  },
});
