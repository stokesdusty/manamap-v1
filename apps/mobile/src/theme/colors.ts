// manamap — DUSK dark theme, green accent. Drop-in replacement for
// apps/mobile/src/theme/colors.ts. Same keys as the light theme so every
// screen that reads tokens goes dark with no per-component edits.
// Mana identity colors are intentionally unchanged (theme-independent).

export const colors = {
  // Dusk surfaces — deep plum-charcoal (prototype --bg / --surface)
  paper: '#191420',
  surface: '#241E2E',
  surfaceWarm: '#2B2436',
  borderLight: '#332B40',
  border: '#463C56',

  // Text on dark (prototype --ink / --ink-2 / --muted)
  textPrimary: '#F3ECF6',
  textSecondary: '#C4B9CF',
  textTertiary: '#8E839B',
  textInverse: '#FFFFFF', // used on the accent button + tinted avatars

  // Accent — green (prototype #5AA452). accentInk reads on accentLight;
  // accentLight is a subtle tint on the dark surface.
  accent: '#5AA452',
  accentInk: '#A3C7A1',
  accentLight: '#2C3133',

  // Chip surface (prototype --chip-bg / --chip-fg)
  chipBg: '#322A3E',
  chipFg: '#C4B9CF',

  // WUBRG mana pip fills — unchanged across themes (prototype MANA.fill)
  mana: {
    W: '#F0EFED', U: '#4FA9E6', B: '#574F5E', R: '#F0705B', G: '#5FB97E',
    C: '#B8AEA0', M: '#E6C36A',
  },
  manaLight: {
    W: '#F7F6F4', U: '#76BCEC', B: '#7C7681', R: '#F38F7F', G: '#82C89A',
    C: '#C8C0B5', M: '#ECD08B',
  },
  manaDark: {
    W: '#D8D6D3', U: '#4491C6', B: '#4B4451', R: '#CE604E', G: '#529F6C',
    C: '#9E968A', M: '#C6A85B',
  },
  manaBorder: {
    W: '#C8C6C2', U: '#3F97D6', B: '#6B6276', R: '#E25E4A', G: '#4FA96E',
    C: '#A89E90', M: '#C9A227',
  },
  manaLetter: {
    W: '#4A4845', U: '#FFFFFF', B: '#FFFFFF', R: '#FFFFFF', G: '#FFFFFF',
    C: '#3A3340', M: '#6E5A1E',
  },

  // Status — brightened for dark backgrounds
  success: '#4ED07F',
  error: '#F06A66',
  warning: '#E0992E',

  overlay: 'rgba(8, 5, 12, 0.6)',
} as const;

export type ManaColor = keyof typeof colors.mana;
