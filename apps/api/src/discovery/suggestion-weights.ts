export const SUGGESTION_WEIGHTS = {
  sharedFormat: 30,
  powerLevelExact: 25,
  powerLevelClose: 15,
  colorOverlapPerColor: 8,
  positiveEncounterBonus: 15,
  vibeCompatible: 20,
  vibeIncompatible: -10,
} as const;

// 1 = compatible (bonus), -1 = incompatible (penalty), 0 = neutral
export const VIBE_COMPAT: Record<string, Record<string, number>> = {
  competitive: { competitive: 1, spike: 1, casual: -1, timmy: -1, johnny: 0, vorthos: 0, influencer: 0 },
  casual: { casual: 1, timmy: 1, johnny: 1, vorthos: 1, competitive: -1, spike: -1, influencer: 1 },
  spike: { spike: 1, competitive: 1, johnny: 1, timmy: -1, casual: -1, vorthos: 0, influencer: 1 },
  timmy: { timmy: 1, casual: 1, johnny: 0, spike: -1, competitive: -1, vorthos: 0, influencer: 0 },
  johnny: { johnny: 1, spike: 1, casual: 1, vorthos: 1, competitive: 0, timmy: 0, influencer: 1 },
  vorthos: { vorthos: 1, casual: 1, johnny: 1, competitive: 0, spike: 0, timmy: 0, influencer: 0 },
  influencer: { influencer: 1, competitive: 0, casual: 1, spike: 1, timmy: 0, johnny: 1, vorthos: 0 },
};
