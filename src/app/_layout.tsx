import { Ionicons } from '@expo/vector-icons';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppProvider, useApp } from '@/context/AppContext';
import { colors, radius, type } from '@/theme/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.ink,
    border: colors.line,
  },
};

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="dark" />
        <RootStack />
      </ThemeProvider>
    </AppProvider>
  );
}

function RootStack() {
  const { hydrated, user } = useApp();

  if (!hydrated) return <BootScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-group" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="join-group" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="add-expense" options={{ animation: 'slide_from_bottom' }} />
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
  return (
    <View style={styles.boot}>
      <View style={styles.logoSquare}>
        <Ionicons name="airplane" size={30} color="#FFFFFF" />
      </View>
      <Text style={styles.wordmark}>Trivio</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logoSquare: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...type.display, marginTop: 14 },
  spinner: { marginTop: 20 },
});
