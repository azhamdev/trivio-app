import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { colors, radius } from '@/theme/theme';

type Variant = 'primary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PALETTE: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF' },
  ghost: { bg: colors.primarySoft, fg: colors.primaryDark },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: Props) {
  const { bg, fg } = PALETTE[variant];
  const blocked = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={blocked}
      style={[styles.base, small && styles.small, { backgroundColor: bg, opacity: blocked ? 0.5 : 1 }, style]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.title, small && styles.titleSmall, { color: fg }]}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  small: { height: 44, paddingHorizontal: 16 },
  title: { fontSize: 15.5, fontWeight: '700' },
  titleSmall: { fontSize: 14 },
});
