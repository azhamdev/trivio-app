import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import PressableScale from '@/components/PressableScale';
import { parseReceipt, ReceiptParseResult } from '@/ai/receiptOcr';
import { colors, radius, type } from '@/theme/theme';

type Props = {
  // Called with the parsed draft so the parent form can pre-fill its fields.
  // Never auto-submits — the user still reviews and taps Save.
  onParsed: (result: ReceiptParseResult) => void;
  style?: StyleProp<ViewStyle>;
};

type Banner = { kind: 'error' | 'success'; text: string } | null;

const FAIL_TEXT = "Couldn't read this receipt — enter the details manually.";

// Shared "Scan receipt" affordance for both expense-entry forms. Owns the whole
// pick → parse → pre-fill flow plus its loading and fallback-banner UI, so the
// forms only implement how a parsed draft maps onto their fields.
export default function ReceiptScanButton({ onParsed, style }: Props) {
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const ensurePermission = async (source: 'camera' | 'library'): Promise<boolean> => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.granted) return true;
    Alert.alert(
      source === 'camera' ? 'Camera access needed' : 'Photo access needed',
      `Trivio needs ${source === 'camera' ? 'camera' : 'photo library'} access to scan a receipt. You can turn it on in Settings.`
    );
    return false;
  };

  const runPick = async (source: 'camera' | 'library') => {
    setBanner(null);
    try {
      if (!(await ensurePermission(source))) return;

      const launch =
        source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({
        mediaTypes: ['images'],
        quality: 0.5, // smaller base64 payload; still legible for OCR
        base64: true,
        allowsEditing: false,
      });
      if (result.canceled) return;

      const base64 = result.assets?.[0]?.base64;
      if (!base64) {
        setBanner({ kind: 'error', text: FAIL_TEXT });
        return;
      }

      setScanning(true);
      const parsed = await parseReceipt(base64);
      if (!parsed) {
        setBanner({ kind: 'error', text: FAIL_TEXT });
        return;
      }

      onParsed(parsed);
      setBanner({
        kind: 'success',
        text:
          parsed.confidence === 'low'
            ? 'Filled from the receipt, but it was hard to read — double-check the amount and category.'
            : 'Filled from the receipt — review the details before saving.',
      });
    } catch (err) {
      console.warn('Trivio receipt scan failed —', err);
      setBanner({ kind: 'error', text: FAIL_TEXT });
    } finally {
      setScanning(false);
    }
  };

  const start = () => {
    if (scanning) return;
    // RN Web's Alert only surfaces one button, so skip the chooser and use the
    // file picker directly there.
    if (Platform.OS === 'web') {
      runPick('library');
      return;
    }
    Alert.alert('Scan receipt', 'Snap a photo or pick one from your library.', [
      { text: 'Take photo', onPress: () => runPick('camera') },
      { text: 'Choose from library', onPress: () => runPick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={style}>
      <PressableScale
        onPress={start}
        disabled={scanning}
        accessibilityRole="button"
        accessibilityLabel="Scan a receipt to fill in the expense"
        accessibilityState={{ disabled: scanning, busy: scanning }}
        style={[styles.button, scanning && styles.buttonBusy]}>
        {scanning ? (
          <ActivityIndicator color={colors.primaryDark} />
        ) : (
          <Ionicons name="scan-outline" size={18} color={colors.primaryDark} />
        )}
        <Text style={styles.buttonText}>{scanning ? 'Reading receipt…' : 'Scan receipt'}</Text>
      </PressableScale>

      {banner ? (
        <View
          style={[styles.banner, banner.kind === 'error' ? styles.bannerError : styles.bannerSuccess]}>
          <Ionicons
            name={banner.kind === 'error' ? 'alert-circle-outline' : 'sparkles-outline'}
            size={16}
            color={banner.kind === 'error' ? colors.danger : colors.primaryDark}
          />
          <Text
            style={[
              styles.bannerText,
              { color: banner.kind === 'error' ? colors.danger : colors.primaryDark },
            ]}>
            {banner.text}
          </Text>
          <Pressable
            onPress={() => setBanner(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message">
            <Ionicons
              name="close"
              size={16}
              color={banner.kind === 'error' ? colors.danger : colors.primaryDark}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { fontSize: 15, fontWeight: '700', color: colors.primaryDark },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  bannerError: { backgroundColor: colors.dangerSoft },
  bannerSuccess: { backgroundColor: colors.primarySoft },
  bannerText: { ...type.caption, flex: 1, lineHeight: 17 },
});
