export const colors = {
  // Soft paper — warm off-white backgrounds
  paper: '#F7F3EE',
  surface: '#FFFFFF',
  surfaceWarm: '#FBF8F4',
  borderLight: '#EAE4DC',
  border: '#CFC8BC',

  // Text
  textPrimary: '#1C1917',
  textSecondary: '#78716C',
  textTertiary: '#A8A09A',
  textInverse: '#FFFFFF',

  // Accent — warm amber
  accent: '#A16207',
  accentLight: '#FEF3C7',

  // WUBRG mana pip fills
  mana: {
    W: '#F0E6C8',
    U: '#1A6FA8',
    B: '#2D2D2D',
    R: '#D4281E',
    G: '#1A7A3C',
    C: '#BDBDBD',
    M: '#C9A227',
  },

  // Mana pip border accents
  manaBorder: {
    W: '#C8B87A',
    U: '#0A4A78',
    B: '#1A1A1A',
    R: '#8B1A14',
    G: '#0A4A22',
    C: '#7A7A7A',
    M: '#8B6914',
  },

  // Status
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',

  overlay: 'rgba(28, 25, 23, 0.5)',
} as const;

export type ManaColor = keyof typeof colors.mana;
