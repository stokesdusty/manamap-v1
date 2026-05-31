// Reconciled to the manamap prototype palette (design/app/data.js + Soft-paper theme).
// All keys from the original colors.ts are preserved; new keys (accentInk,
// manaLight, manaDark, manaLetter, chipBg, chipFg) are additive.

export const colors = {
  // Soft paper — warm cream backgrounds (prototype --bg / --surface)
  paper: '#F4ECE0',
  surface: '#FFFCF6',
  surfaceWarm: '#FBF4E9',
  borderLight: '#EBE0D1',
  border: '#D9CBB8',

  // Text (prototype --ink / --ink-2 / --muted)
  textPrimary: '#2A211B',
  textSecondary: '#5B5048',
  textTertiary: '#9C8E7F',
  textInverse: '#FFFFFF',

  // Accent — warm orange (prototype --brand). accentInk is the readable
  // on-soft text tone (prototype --brand-ink); accentLight is the soft fill.
  accent: '#E8743B',
  accentInk: '#A0542F',
  accentLight: '#FBE6D8',

  // Chip surface (prototype --chip-bg / --chip-fg)
  chipBg: '#EFE6D8',
  chipFg: '#6C5E50',

  // WUBRG mana pip fills — soft & playful (prototype MANA.fill)
  mana: {
    W: '#F2E6BE',
    U: '#4FA9E6',
    B: '#574F5E',
    R: '#F0705B',
    G: '#5FB97E',
    C: '#B8AEA0',
    M: '#E6C36A',
  },

  // Highlight stop for the radial sheen (prototype shade(fill, +22))
  manaLight: {
    W: '#F5ECCC',
    U: '#76BCEC',
    B: '#7C7681',
    R: '#F38F7F',
    G: '#82C89A',
    C: '#C8C0B5',
    M: '#ECD08B',
  },

  // Shadow stop (prototype shade(fill, -14))
  manaDark: {
    W: '#D0C6A3',
    U: '#4491C6',
    B: '#4B4451',
    R: '#CE604E',
    G: '#529F6C',
    C: '#9E968A',
    M: '#C6A85B',
  },

  // Pip ring / border (prototype MANA.ring)
  manaBorder: {
    W: '#E4D199',
    U: '#3F97D6',
    B: '#473F4E',
    R: '#E25E4A',
    G: '#4FA96E',
    C: '#A89E90',
    M: '#C9A227',
  },

  // Letter color inside the pip (prototype MANA.letter)
  manaLetter: {
    W: '#6E5E27',
    U: '#FFFFFF',
    B: '#FFFFFF',
    R: '#FFFFFF',
    G: '#FFFFFF',
    C: '#5A5043',
    M: '#6E5A1E',
  },

  // Status
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',

  overlay: 'rgba(40, 30, 20, 0.45)',
} as const;

export type ManaColor = keyof typeof colors.mana;
