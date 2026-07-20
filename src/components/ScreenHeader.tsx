import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '@/components/PressableScale';
import { colors, type } from '@/theme/theme';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export default function ScreenHeader({ title, subtitle, right }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <PressableScale onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </PressableScale>
      <View style={styles.middle}>
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  subtitle: { ...type.caption, marginTop: 2 },
  spacer: { width: 40 },
});
