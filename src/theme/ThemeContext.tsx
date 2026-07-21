import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

import { colors as lightColors } from '@/theme/theme';

export type ThemeColors = typeof lightColors;
export type ThemePreference = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

// Appearance can report values other than 'light'/'dark' (e.g. 'unspecified'
// on some Android setups, or null/undefined) — treat anything but an
// explicit 'dark' as light.
const toScheme = (value: ColorSchemeName | null | undefined): ColorScheme => (value === 'dark' ? 'dark' : 'light');

const PREF_KEY = 'trivio:theme:v1';

// Same key shape as the static `colors` export in theme.ts — any screen
// that adopts `useThemeColors()` can swap in this object with no other changes.
const darkColors: ThemeColors = {
  primary: '#2CA8FF',
  primaryDark: '#7CCBFF',
  primarySoft: '#12283B',
  ink: '#EAF2FA',
  slate: '#9FB0C2',
  faint: '#5D6E80',
  line: '#22303F',
  bg: '#0B1520',
  card: '#121E2B',
  success: '#34D399',
  successSoft: '#0F2A20',
  warning: '#FBBF24',
  warningSoft: '#332107',
  danger: '#FF6B6B',
  dangerSoft: '#3A1518',
};

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: ColorScheme;
  colors: ThemeColors;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(toScheme(Appearance.getColorScheme()));

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((raw) => {
        if (raw === 'light' || raw === 'dark' || raw === 'system') setPreferenceState(raw);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(toScheme(colorScheme)));
    return () => sub.remove();
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(PREF_KEY, pref).catch(() => {});
  };

  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference;
  const themeColors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, colors: themeColors, setPreference }),
    [preference, scheme, themeColors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Falls back to the static light palette if called outside the provider,
// so components can adopt it incrementally without crashing.
export function useThemeColors(): ThemeColors {
  const ctx = useContext(ThemeContext);
  return ctx ? ctx.colors : lightColors;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeContextProvider');
  return ctx;
}
