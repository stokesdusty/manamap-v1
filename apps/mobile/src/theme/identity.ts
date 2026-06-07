import type { ManaColor } from './colors';
import { colors } from './colors';

// Vivid UI-ready accent per mana color. Black → violet, White → gold so both
// read on the Dusk dark theme. C = colorless/fallback.
export const MANA_ACCENT: Record<string, string> = {
  W: '#D7A93C',
  U: '#3E8FE6',
  B: '#8E63D6',
  R: '#EC5B47',
  G: '#4FA85C',
  C: '#8E8896',
};

// ----------------------------------------------------------------------------
// Hex color math
// ----------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

// Lighten (delta > 0) or darken (delta < 0) a hex color by percentage points.
export function shade(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (delta >= 0) {
    const f = delta / 100;
    return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  }
  const f = 1 + delta / 100;
  return rgbToHex(r * f, g * f, b * f);
}

function luminance(hex: string): number {
  const cs = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * cs[0] + 0.7152 * cs[1] + 0.0722 * cs[2];
}

// ----------------------------------------------------------------------------
// Identity helpers
// ----------------------------------------------------------------------------

export function manaAccent(manaColors: ManaColor[]): string {
  return MANA_ACCENT[manaColors[0]] ?? MANA_ACCENT['C'];
}

export function manaAccent2(manaColors: ManaColor[]): string {
  if (manaColors.length === 0) return MANA_ACCENT['C'];
  return MANA_ACCENT[manaColors[manaColors.length - 1]] ?? MANA_ACCENT['C'];
}

// Returns SVG LinearGradient stop colors for the player's color identity.
// Single color: base → shade(+10) → shade(-22). Multi: each accent as a stop.
export function identityGradientStops(manaColors: ManaColor[]): string[] {
  if (!manaColors || manaColors.length === 0) {
    return [colors.accent, shade(colors.accent, 10), shade(colors.accent, -22)];
  }
  if (manaColors.length === 1) {
    const base = manaAccent(manaColors);
    return [base, shade(base, 10), shade(base, -22)];
  }
  return manaColors.map((c) => MANA_ACCENT[c] ?? MANA_ACCENT['C']);
}

// '#2A211B' (dark brown) if the color is light enough, else white — safe text
// on any identity accent.
export function readableOn(hex: string): string {
  return luminance(hex) > 0.62 ? '#2A211B' : '#fff';
}

// Mix accent into the surface at 18% — analogous to colors.accentLight.
export function accentSoft(accent: string): string {
  const [ar, ag, ab] = hexToRgb(accent);
  const [sr, sg, sb] = hexToRgb(colors.surface);
  return rgbToHex(sr + (ar - sr) * 0.18, sg + (ag - sg) * 0.18, sb + (ab - sb) * 0.18);
}

// Lighten accent 40% toward white — analogous to colors.accentInk.
export function accentInk(accent: string): string {
  const [ar, ag, ab] = hexToRgb(accent);
  return rgbToHex(ar + (255 - ar) * 0.4, ag + (255 - ag) * 0.4, ab + (255 - ab) * 0.4);
}

// ----------------------------------------------------------------------------
// Guild / combo naming (WUBRG sorted key lookup)
// ----------------------------------------------------------------------------

const WUBRG = 'WUBRG';

function sortColors(cs: ManaColor[]): ManaColor[] {
  return [...cs].sort((a, b) => WUBRG.indexOf(a) - WUBRG.indexOf(b));
}

const GUILD_NAMES: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green',
  WU: 'Azorius', WB: 'Orzhov', WR: 'Boros', WG: 'Selesnya',
  UB: 'Dimir', UR: 'Izzet', UG: 'Simic',
  BR: 'Rakdos', BG: 'Golgari', RG: 'Gruul',
  WUB: 'Esper', WUR: 'Jeskai', WUG: 'Bant',
  WBR: 'Mardu', WBG: 'Abzan', WRG: 'Naya',
  UBR: 'Grixis', UBG: 'Sultai', URG: 'Temur',
  BRG: 'Jund',
  WUBR: 'Non-Green', WUBG: 'Non-Red', WURG: 'Non-Black',
  WBRG: 'Non-Blue', UBRG: 'Non-White',
  WUBRG: 'Five-Color',
};

export function guildName(manaColors: ManaColor[]): string {
  if (manaColors.length === 0) return '';
  return GUILD_NAMES[sortColors(manaColors).join('')] ?? manaColors.join('/');
}
