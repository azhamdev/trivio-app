import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius } from '@/theme/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  editable?: boolean;
  // Fired once the last digit is entered — handy for auto-submitting.
  onComplete?: (value: string) => void;
};

// Segmented one-time-code field: a row of boxes drawn purely for looks, with a
// single transparent TextInput stretched over them capturing the real input.
// Tapping anywhere focuses that input, so the caret/selection quirks of
// per-box inputs never come up.
export default function CodeInput({
  value,
  onChangeText,
  length = 6,
  autoFocus,
  editable = true,
  onComplete,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const char = value[i] ?? '';
        // Highlight the slot the next digit lands in (or the last one when full).
        const isActive =
          focused && (i === value.length || (value.length >= length && i === length - 1));
        return (
          <View
            key={i}
            style={[styles.box, char ? styles.boxFilled : null, isActive ? styles.boxActive : null]}>
            <Text style={styles.char}>{char}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.primary },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  char: { fontSize: 24, fontWeight: '800', color: colors.ink },
  // Transparent overlay that actually receives the keystrokes.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
});
