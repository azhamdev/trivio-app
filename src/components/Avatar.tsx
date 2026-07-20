import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

import { initials } from '@/utils/format';

// Deterministic soft-pastel palette so each member keeps a stable color.
const PALETTE: [string, string][] = [
  ['#E8F4FE', '#0272BC'],
  ['#E7F8F1', '#0F8A5F'],
  ['#F1EBFE', '#6D3BD8'],
  ['#FDEAF3', '#C2367F'],
  ['#FEF3E2', '#B45D07'],
  ['#EEF2F6', '#45566B'],
];

type Props = { name?: string; size?: number; style?: StyleProp<ViewStyle> };

export default function Avatar({ name = '', size = 36, style }: Props) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);
  const [bg, fg] = PALETTE[hash % PALETTE.length];
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: Math.round(size * 0.38) }}>
        {initials(name)}
      </Text>
    </View>
  );
}
