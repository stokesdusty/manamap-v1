import { z } from 'zod';

// --- Primitives ---

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

export const TimestampSchema = z.string().datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

// --- Geo ---

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof CoordinatesSchema>;

// --- Domain enums ---

export const ManaColorSchema = z.enum(['W', 'U', 'B', 'R', 'G']);
export type ManaColor = z.infer<typeof ManaColorSchema>;

export const MtgFormatSchema = z.enum([
  'standard',
  'pioneer',
  'modern',
  'legacy',
  'vintage',
  'commander',
  'draft',
]);
export type MtgFormat = z.infer<typeof MtgFormatSchema>;

export const PlayerVibeSchema = z.enum([
  'competitive',
  'casual',
  'spike',
  'timmy',
  'johnny',
  'vorthos',
]);
export type PlayerVibe = z.infer<typeof PlayerVibeSchema>;

export const DeckSiteSchema = z.enum(['moxfield', 'archidekt']);
export type DeckSite = z.infer<typeof DeckSiteSchema>;

export const DECK_SITE_HOSTS: Record<DeckSite, string> = {
  moxfield: 'moxfield.com',
  archidekt: 'archidekt.com',
};

// --- User ---

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(64),
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

// --- Public profile (safe subset returned by exchange/resolve) ---

export const PublicProfileSchema = z.object({
  id: IdSchema,
  displayName: z.string().min(1).max(64),
  pronouns: z.string().max(32).nullable(),
  bio: z.string().max(500).nullable(),
  avatarColors: z.array(ManaColorSchema),
  commander: z.string().max(128).nullable(),
  powerLevel: z.number().int().min(1).max(10).nullable(),
  vibe: PlayerVibeSchema.nullable(),
  formats: z.array(MtgFormatSchema),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

// --- Exchange (QR token) ---

export const ExchangeTokenSchema = z.object({
  token: z.string().min(1),
  expiresAt: TimestampSchema,
});
export type ExchangeToken = z.infer<typeof ExchangeTokenSchema>;

export const ResolveTokenBodySchema = z.object({
  token: z.string().min(1, 'token is required'),
});
export type ResolveTokenBody = z.infer<typeof ResolveTokenBodySchema>;

// --- Profile ---

export const ProfileSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(64),
  pronouns: z.string().max(32).nullable(),
  bio: z.string().max(500).nullable(),
  avatarColors: z.array(ManaColorSchema),
  commander: z.string().max(128).nullable(),
  powerLevel: z.number().int().min(1).max(10).nullable(),
  vibe: PlayerVibeSchema.nullable(),
  formats: z.array(MtgFormatSchema),
  createdAt: TimestampSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  pronouns: z.string().max(32).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarColors: z.array(ManaColorSchema).max(5).optional(),
  commander: z.string().max(128).nullable().optional(),
  powerLevel: z.number().int().min(1).max(10).nullable().optional(),
  vibe: PlayerVibeSchema.nullable().optional(),
  formats: z.array(MtgFormatSchema).optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// --- Privacy ---

export const PrivacySchema = z.object({
  discoverable: z.boolean(),
  showDiscord: z.boolean(),
  showDecks: z.boolean(),
  showMetHistory: z.boolean(),
});
export type Privacy = z.infer<typeof PrivacySchema>;

export const UpdatePrivacySchema = z.object({
  discoverable: z.boolean().optional(),
  showDiscord: z.boolean().optional(),
  showDecks: z.boolean().optional(),
  showMetHistory: z.boolean().optional(),
});
export type UpdatePrivacy = z.infer<typeof UpdatePrivacySchema>;

// --- Deck links ---

function deckUrlHostValid(site: DeckSite, url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const expected = DECK_SITE_HOSTS[site];
    return host === expected || host.endsWith(`.${expected}`);
  } catch {
    return false;
  }
}

export const DeckLinkSchema = z.object({
  id: IdSchema,
  site: DeckSiteSchema,
  name: z.string().min(1).max(64),
  url: z.string().url(),
});
export type DeckLink = z.infer<typeof DeckLinkSchema>;

export const CreateDeckLinkSchema = z
  .object({
    site: DeckSiteSchema,
    name: z.string().min(1).max(64),
    url: z.string().url(),
  })
  .refine((d) => deckUrlHostValid(d.site, d.url), {
    message: 'URL host does not match the selected site',
    path: ['url'],
  });
export type CreateDeckLink = z.infer<typeof CreateDeckLinkSchema>;

export const UpdateDeckLinkSchema = z
  .object({
    site: DeckSiteSchema.optional(),
    name: z.string().min(1).max(64).optional(),
    url: z.string().url().optional(),
  })
  .refine(
    (d) => {
      if (!d.site || !d.url) return true;
      return deckUrlHostValid(d.site, d.url);
    },
    { message: 'URL host does not match the selected site', path: ['url'] },
  );
export type UpdateDeckLink = z.infer<typeof UpdateDeckLinkSchema>;

// --- Place ---

export const PlaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(128),
  coordinates: CoordinatesSchema,
  createdById: IdSchema,
  createdAt: TimestampSchema,
});
export type Place = z.infer<typeof PlaceSchema>;

// --- Auth request / response ---

export const AppleAuthBodySchema = z.object({
  identityToken: z.string().min(1, 'identityToken is required'),
});
export type AppleAuthBody = z.infer<typeof AppleAuthBodySchema>;

export const DiscordAuthBodySchema = z.object({
  code: z.string().min(1, 'code is required'),
});
export type DiscordAuthBody = z.infer<typeof DiscordAuthBodySchema>;

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

export const LogoutBodySchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});
export type LogoutBody = z.infer<typeof LogoutBodySchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(), // seconds
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

// --- API response envelope ---

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
