import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { setEventColorScheme } from './utils/color';

// Warm "paper planner" palette: cream paper, ink text, one tomato accent. Dark mode is the same
// idea at night: warm charcoal paper, cream ink, a slightly brighter tomato.
const light = {
  bg: '#F5EFE6',
  surface: '#FFFCF7',
  surfaceAlt: '#EEE6D9',
  border: '#E5DBCB',
  hairline: '#EDE5D8',
  text: '#221D17',
  textMuted: '#7C7266',
  textFaint: '#B1A797',
  /** Strong neutral used for selected segments and high-emphasis cards. */
  ink: '#221D17',
  onInk: '#FFFCF7',
  onInkMuted: 'rgba(255, 252, 247, 0.68)',
  primary: '#E2553A',
  primarySoft: '#FBE3DA',
  /** Text/icons drawn on `primary`. */
  onPrimary: '#FFFCF7',
  weekend: '#FAF5EE',
  danger: '#B83227',
  dangerSoft: '#F6DDD8',
  nowLine: '#E2553A',
  backdrop: 'rgba(34, 29, 23, 0.4)',
  dock: '#221D17',
  onDock: '#FFFCF7',
  onDockMuted: 'rgba(255, 252, 247, 0.55)',
  dockButton: 'rgba(255, 252, 247, 0.1)',
  shadow: '#3A2A18',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#15120F',
  surface: '#1F1B16',
  surfaceAlt: '#2A251E',
  border: '#39322A',
  hairline: '#2C2620',
  text: '#F2EBE0',
  textMuted: '#A99F92',
  textFaint: '#6E655A',
  ink: '#F2EBE0',
  onInk: '#1A1612',
  onInkMuted: 'rgba(26, 22, 18, 0.66)',
  primary: '#F06A4D',
  primarySoft: '#3B231B',
  onPrimary: '#FFFCF7',
  weekend: '#1B1814',
  danger: '#F2685C',
  dangerSoft: '#3B1D19',
  nowLine: '#F06A4D',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  dock: '#2E2821',
  onDock: '#F2EBE0',
  onDockMuted: 'rgba(242, 235, 224, 0.5)',
  dockButton: 'rgba(242, 235, 224, 0.08)',
  shadow: '#000000',
};

export const palettes = { light, dark };

export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

/** Font families loaded in App.tsx. Body text uses the platform system font. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_800ExtraBold',
  displayItalic: 'Fraunces_500Medium_Italic',
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const shadow = {
  shadowColor: '#3A2A18',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

/** Built-in swatches with display names (shown in the color picker). */
export const NAMED_PALETTE: { hex: string; name: string }[] = [
  { hex: '#4F6BED', name: 'Iris' },
  { hex: '#3B82F6', name: 'Cobalt' },
  { hex: '#06B6D4', name: 'Lagoon' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#22C55E', name: 'Leaf' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#EAB308', name: 'Mustard' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#F2994A', name: 'Apricot' },
  { hex: '#EF4444', name: 'Cherry' },
  { hex: '#E5484D', name: 'Poppy' },
  { hex: '#EC4899', name: 'Flamingo' },
  { hex: '#D946EF', name: 'Orchid' },
  { hex: '#A855F7', name: 'Amethyst' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#64748B', name: 'Slate' },
  { hex: '#78716C', name: 'Stone' },
  { hex: '#1F2937', name: 'Ink' },
];

export const PALETTE = NAMED_PALETTE.map((c) => c.hex);

interface ThemeValue {
  colors: Palette;
  scheme: ColorScheme;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeValue>({ colors: light, scheme: 'light', mode: 'system' });

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: React.ReactNode }) {
  const system = useColorScheme();
  const scheme: ColorScheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  // Event tints are computed by plain helpers (softBg/deepText); point them at the active paper color
  // before any child renders.
  setEventColorScheme(scheme);
  const value = useMemo(() => ({ colors: palettes[scheme], scheme, mode }), [scheme, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeValue => useContext(ThemeContext);

/**
 * Themed StyleSheet factory. Call at module level, then use the returned hook inside components:
 *   const useStyles = createStyles((colors) => ({ box: { backgroundColor: colors.surface } }));
 *   const styles = useStyles();
 * Sheets are built once per palette and cached.
 */
export function createStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const { colors } = useContext(ThemeContext);
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}
