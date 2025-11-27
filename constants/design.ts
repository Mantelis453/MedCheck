export const Colors = {
  // Modern iOS-inspired primary colors
  primary: '#007AFF',
  primaryLight: '#4DA2FF',
  primaryDark: '#0051D5',
  secondary: '#FFFFFF',

  // Vibrant accent colors
  accent: '#5856D6',
  accentDark: '#4240B8',
  accentLight: '#7C7AE8',

  // System colors (iOS-style)
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  error: '#FF3B30',
  info: '#5AC8FA',

  // Premium gradient colors
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
  gradientPurple: '#9D50BB',
  gradientBlue: '#6E8EFB',

  // Background layers
  background: '#F2F2F7',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#F9F9FB',
  backgroundDark: '#E5E5EA',

  // Surface elevations
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHover: '#FAFBFC',

  // Text hierarchy
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#AEAEB2',
  textOnDark: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  text: {
    primary: '#000000',
    secondary: '#8E8E93',
    tertiary: '#AEAEB2',
    onDark: '#FFFFFF',
    onAccent: '#FFFFFF',
    light: '#C7C7CC',
  },

  // Borders and dividers
  border: '#E5E5EA',
  borderLight: '#F2F2F7',
  divider: '#C6C6C8',
  separator: '#E5E5EA',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(255, 255, 255, 0.92)',
  overlayDark: 'rgba(0, 0, 0, 0.6)',

  // Badge and pill backgrounds
  badgeBackground: 'rgba(0, 122, 255, 0.1)',
  badgeBackgroundDark: 'rgba(0, 0, 0, 0.5)',
  pillBackground: 'rgba(120, 120, 128, 0.12)',

  // Card and input
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  placeholder: '#C7C7CC',
  inputBg: '#FFFFFF',
  inputBorder: '#E5E5EA',

  // Status colors
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  round: 9999,
  pill: 9999,
};

export const Typography = {
  displayLarge: {
    fontSize: 40,
    fontWeight: '700' as const,
    letterSpacing: -1,
    lineHeight: 48,
  },
  displayMedium: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
  },

  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },

  bodyLarge: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  labelLarge: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },

  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },

  button: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },

  subheading: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
};

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Subtle iOS-style shadows
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },

  // Soft, diffused shadow
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },

  // Card shadow
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  // Floating element shadow
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const IconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const ButtonHeight = {
  sm: 40,
  md: 48,
  lg: 56,
  xl: 64,
};

export const InputHeight = {
  sm: 44,
  md: 48,
  lg: 56,
};

export const MinTouchTarget = 44;

export const AnimationDuration = {
  fast: 200,
  normal: 300,
  slow: 500,
  extraSlow: 800,
};
