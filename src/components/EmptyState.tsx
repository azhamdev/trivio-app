import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import Button from '@/components/Button';
import { type } from '@/theme/theme';
import { useThemeColors } from '@/theme/ThemeContext';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function EmptyState({ icon, title, message, actionTitle, onAction, style }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.slate }]}>{message}</Text>
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} small style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { ...type.subtitle, marginBottom: 6 },
  message: { ...type.body, textAlign: 'center', maxWidth: 300 },
  action: { marginTop: 18 },
});
