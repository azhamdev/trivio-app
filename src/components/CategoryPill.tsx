import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { Category } from '@/data/categories';
import { colors, radius } from '@/theme/theme';

type Props = { category: Category; selected: boolean; onPress: () => void };

export default function CategoryPill({ category, selected, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? category.tint : colors.card,
          borderColor: selected ? category.color : colors.line,
        },
      ]}>
      <Ionicons name={category.icon} size={18} color={selected ? category.color : colors.slate} />
      <Text style={[styles.label, { color: selected ? category.color : colors.slate }]}>
        {category.label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
