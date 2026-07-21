import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';

import { colors } from '@/theme/theme';

type Props = {
  value: number; // 0..1, values above 1 mean over budget
  height?: number;
  color?: string;
  trackColor?: string;
  animateDelay?: number;
  style?: StyleProp<ViewStyle>;
};

// Budget bar that fills with an eased sweep. Turns amber at 80% and red
// once the budget is blown, unless an explicit color is passed.
export default function ProgressBar({
  value,
  height = 10,
  color,
  trackColor = colors.line,
  animateDelay = 0,
  style,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(value, 1));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      Animated.timing(anim, {
        toValue: clamped,
        duration: reduceMotion ? 0 : 900,
        delay: reduceMotion ? 0 : animateDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width animation needs the JS driver
      }).start();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  const barColor =
    color ?? (value >= 1 ? colors.danger : value >= 0.8 ? colors.warning : colors.primary);

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' },
        style,
      ]}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: barColor,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
