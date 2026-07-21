import { Platform, TextStyle, ViewStyle } from 'react-native';

// Design tokens — single source of truth for the Trivio look.
// Minimalist blue & white, travel-booking-app energy.

export const colors = {
  primary: '#0194F3',
  primaryDark: '#0272BC',
  primarySoft: '#E8F4FE',
  ink: '#0B2239',
  slate: '#5B6B7C',
  faint: '#93A3B4',
  line: '#E4EDF4',
  bg: '#F6FAFD',
  card: '#FFFFFF',
  success: '#149E60',
  successSoft: '#E7F8F1',
  warning: '#F59E0B',
  warningSoft: '#FEF3E2',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 };

export const shadow: Record<'card' | 'fab', ViewStyle> = {
  card: {
    shadowColor: '#0B2239',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  fab: {
    shadowColor: '#0272BC',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

export const type: Record<
  'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'overline' | 'stat' | 'heroInput',
  TextStyle
> = {
  display: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', color: colors.slate },
  caption: { fontSize: 12.5, color: colors.faint },
  overline: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.slate,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Big money/count figures — budget totals, profile stat cards.
  stat: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  // The large editable amount figure on expense-entry screens.
  heroInput: { fontSize: 40, fontWeight: '800', color: colors.ink },
};

// Core Animated's native driver isn't available on react-native-web.
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
