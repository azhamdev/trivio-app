import React, { ReactNode, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER } from '@/theme/theme';

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

// Springy press feedback used by every tappable surface in the app.
export default function PressableScale({ children, style, scaleTo = 0.96, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable onPressIn={() => springTo(scaleTo)} onPressOut={() => springTo(1)} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
