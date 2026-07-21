// Supabase client — the single source of truth for the backend transport.
//
// Session persistence reuses the already-installed AsyncStorage (no extra
// dependency): tokens live under Supabase's own keys, replacing the bespoke
// `trivio:session:v1` key the AsyncStorage mock used. detectSessionInUrl is off
// because there's no browser redirect flow on native.
//
// NOTE: EXPO_PUBLIC_* vars are inlined into the client bundle. The anon key is
// meant to ship publicly — Row Level Security (see supabase/migrations) is the
// actual protection, not key secrecy.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud and early — every screen depends on this, so a missing key should
  // surface as a clear boot error, not a confusing "network" failure later.
  throw new Error(
    'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase can only auto-refresh tokens while the JS runtime is active. Pause
// refreshing when the app backgrounds and resume when it returns to the
// foreground — the canonical React Native pattern.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
