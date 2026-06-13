import { useMemo } from 'react';
import { colors, type ManaColor } from '../theme/colors';
import {
  manaAccent,
  manaAccent2,
  identityGradientStops,
  readableOn,
  accentSoft,
  accentInk,
} from '../theme/identity';
import { useProfile } from './useMe';

export interface IdentityTheme {
  accent: string;
  accent2: string;
  gradient: string[];
  onAccent: string;
  soft: string;
  ink: string;
}

const FALLBACK: IdentityTheme = {
  accent: colors.accent,
  accent2: colors.accent,
  gradient: [colors.accent, colors.accent],
  onAccent: colors.textInverse,
  soft: colors.accentLight,
  ink: colors.accentInk,
};

// Returns identity-themed accent values derived from the current user's
// avatarColors. Re-computes when avatarColors change. Falls back to the
// static brand green for users with no colors set.
export function useIdentityTheme(): IdentityTheme {
  const { data: profile } = useProfile();
  const key = (profile?.avatarColors ?? []).join(',');

  return useMemo((): IdentityTheme => {
    const avatarColors = key.length > 0 ? (key.split(',') as ManaColor[]) : [];
    if (avatarColors.length === 0) return FALLBACK;
    const accent = manaAccent(avatarColors);
    const accent2 = manaAccent2(avatarColors);
    return {
      accent,
      accent2,
      gradient: identityGradientStops(avatarColors),
      onAccent: readableOn(accent),
      soft: accentSoft(accent),
      ink: accentInk(accent),
    };
  }, [key]);
}
