import React, { ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER } from '@/theme/theme';

type Props = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
};

// Entrance animation: fades in while sliding up. Stagger lists by passing
// an increasing delay per item. Jumps straight to the end state when the
// user has Reduce Motion enabled.
export default function FadeSlideIn({ children, delay = 0, duration = 420, from = 16, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      Animated.timing(anim, {
        toValue: 1,
        duration: reduceMotion ? 0 : duration,
        delay: reduceMotion ? 0 : delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}
