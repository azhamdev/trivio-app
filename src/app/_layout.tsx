import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppProvider, useApp } from '@/context/AppContext';
import { radius, type } from '@/theme/theme';
import { ThemeContextProvider, useTheme, useThemeColors } from '@/theme/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeContextProvider>
      <AppProvider>
        <RootThemed />
      </AppProvider>
    </ThemeContextProvider>
  );
}

// Bridges our own light/dark palette into React Navigation's theme (used by
// the Stack for default background/border colors) and the status bar style.
function RootThemed() {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.card,
      text: colors.ink,
      border: colors.line,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootStack />
    </ThemeProvider>
  );
}

function RootStack() {
  const { hydrated, user } = useApp();
  const colors = useThemeColors();

  if (!hydrated) return <BootScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-group" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="join-group" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="add-expense" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="create-personal-budget" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="budget/[id]" />
        <Stack.Screen name="add-personal-expense" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

// Shown for the instant it takes to hydrate persisted state from storage.
function BootScreen() {
  const colors = useThemeColors();
  return (
    <View style={[styles.boot, { backgroundColor: colors.bg }]}>
      <View style={[styles.logoSquare, { backgroundColor: colors.primary }]}>
        <Ionicons name="airplane" size={30} color="#FFFFFF" />
      </View>
      <Text style={[type.display, styles.wordmark, { color: colors.ink }]}>Trivio</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoSquare: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { marginTop: 14 },
  spinner: { marginTop: 20 },
});
