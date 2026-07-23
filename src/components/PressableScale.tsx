import React, { ReactNode, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER } from '@/theme/theme';

// Animate the Pressable itself so the touch target and the visible/animated
// surface are the exact same element. Applying `style` to an inner wrapper
// (e.g. an absolutely-positioned FAB) collapses the Pressable to 0×0 and makes
// it untappable even though the child still renders in place.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
    <AnimatedPressable
      onPressIn={() => springTo(scaleTo)}
      onPressOut={() => springTo(1)}
      style={[style, { transform: [{ scale }] }]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
