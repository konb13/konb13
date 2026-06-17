import { useColorScheme } from 'react-native';

// Apple-style adaptive design tokens. Colors mirror iOS system colors and
// follow the device light/dark setting. Typography uses the platform system
// font (San Francisco on iOS) via undefined fontFamily.

export interface Palette {
  /** Grouped table background (behind cards). */
  bg: string;
  /** Card / cell surface. */
  surface: string;
  /** Slightly elevated fill (segmented controls, chips). */
  fill: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  green: string;
  red: string;
  amber: string;
  onAccent: string;
  shadow: string;
}

const light: Palette = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  fill: '#E9E9EF',
  separator: '#D7D7DB',
  text: '#000000',
  textSecondary: '#6C6C70',
  textTertiary: '#A1A1A6',
  accent: '#007AFF',
  accentSoft: 'rgba(0,122,255,0.10)',
  green: '#34C759',
  red: '#FF3B30',
  amber: '#FF9500',
  onAccent: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.10)',
};

const dark: Palette = {
  bg: '#000000',
  surface: '#1C1C1E',
  fill: '#2C2C2E',
  separator: '#38383A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A8',
  textTertiary: '#6C6C70',
  accent: '#0A84FF',
  accentSoft: 'rgba(10,132,255,0.18)',
  green: '#30D158',
  red: '#FF453A',
  amber: '#FF9F0A',
  onAccent: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.40)',
};

export const space = (n: number) => n * 4;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title: { fontSize: 22, fontWeight: '700' as const },
  title3: { fontSize: 20, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '400' as const },
  subhead: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

export interface Theme {
  scheme: 'light' | 'dark';
  c: Palette;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() ?? 'light';
  return { scheme, c: scheme === 'dark' ? dark : light };
}

export const urgencyColor = (u: 'red' | 'amber' | 'green', c: Palette): string =>
  u === 'red' ? c.red : u === 'amber' ? c.amber : c.green;

// Stable accent color per issuer for card "art".
export function issuerAccent(issuer: string): [string, string] {
  const key = issuer.toLowerCase();
  if (key.includes('american express')) return ['#2E77BC', '#1A4D7A'];
  if (key.includes('chase')) return ['#117ACA', '#0A4E80'];
  if (key.includes('capital one')) return ['#D03027', '#8C1D17'];
  if (key.includes('citi')) return ['#1B72BD', '#0E4474'];
  if (key.includes('wells')) return ['#C9242B', '#8A1419'];
  return ['#48484A', '#2C2C2E'];
}
