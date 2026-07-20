import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, type } from '@/theme/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  secure?: boolean;
  left?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function Input({ label, error, secure, left, containerStyle, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError]}>
        {left}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.faint}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.label, marginBottom: 7 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  boxFocused: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    height: '100%',
    ...Platform.select({ web: { outlineStyle: 'none' } as object }),
  },
  error: { fontSize: 12.5, color: colors.danger, marginTop: 6 },
});
