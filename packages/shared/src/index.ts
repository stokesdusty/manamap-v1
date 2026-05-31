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

// --- Connections ---

export const ConnectionStatusSchema = z.enum(['pending', 'accepted', 'blocked']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const CreateConnectionSchema = z.object({
  addresseeId: IdSchema,
  via: z.string().optional(),
  note: z.string().max(200).optional(),
});
export type CreateConnection = z.infer<typeof CreateConnectionSchema>;

export const ConnectionItemSchema = z.object({
  id: IdSchema,
  status: ConnectionStatusSchema,
  direction: z.enum(['sent', 'received']),
  via: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  peer: PublicProfileSchema,
});
export type ConnectionItem = z.infer<typeof ConnectionItemSchema>;

export const ConnectionsListSchema = z.object({
  incoming: z.array(ConnectionItemSchema),
  outgoing: z.array(ConnectionItemSchema),
  accepted: z.array(ConnectionItemSchema),
});
export type ConnectionsList = z.infer<typeof ConnectionsListSchema>;

export const ConnectedProfileSchema = PublicProfileSchema.extend({
  discordHandle: z.string().nullable(),
  deckLinks: z.array(DeckLinkSchema),
});
export type ConnectedProfile = z.infer<typeof ConnectedProfileSchema>;

export const ConnectionDetailSchema = z.object({
  id: IdSchema,
  status: ConnectionStatusSchema,
  direction: z.enum(['sent', 'received']),
  via: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  peer: ConnectedProfileSchema,
});
export type ConnectionDetail = z.infer<typeof ConnectionDetailSchema>;

export const RegisterPushTokenSchema = z.object({
  token: z.string().min(1),
});
export type RegisterPushToken = z.infer<typeof RegisterPushTokenSchema>;

// --- Store ---

export const StoreSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(128),
  city: z.string().nullable(),
  state: z.string().nullable(),
});
export type Store = z.infer<typeof StoreSchema>;

export const StorePinSchema = z.object({
  id: IdSchema,
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type StorePin = z.infer<typeof StorePinSchema>;

export const StoreDetailSchema = z.object({
  id: IdSchema,
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  discordUrl: z.string().url().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type StoreDetail = z.infer<typeof StoreDetailSchema>;

export const BadgeSchema = z.object({
  id: IdSchema,
  code: z.string(),
  name: z.string(),
  icon: z.string(),
  description: z.string().nullable(),
});
export type Badge = z.infer<typeof BadgeSchema>;

export const EarnedBadgeSchema = BadgeSchema;
export type EarnedBadge = Badge;

export const StoreStreakSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  totalCheckins: z.number().int().nonnegative(),
});
export type StoreStreak = z.infer<typeof StoreStreakSchema>;

export const UserBadgeSchema = z.object({
  id: IdSchema,
  earnedAt: TimestampSchema,
  badge: BadgeSchema,
  store: z.object({ id: IdSchema, name: z.string() }).nullable(),
});
export type UserBadge = z.infer<typeof UserBadgeSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: IdSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  avatarColors: z.array(z.string()),
  currentStreak: z.number().int().nonnegative(),
  totalCheckins: z.number().int().nonnegative(),
  isMe: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  myEntry: z.object({
    rank: z.number().int().positive(),
    currentStreak: z.number().int().nonnegative(),
    totalCheckins: z.number().int().nonnegative(),
  }).nullable(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const CheckinResultSchema = z.object({
  checkinId: IdSchema,
  storeId: IdSchema,
  storeName: z.string(),
  checkedInAt: TimestampSchema,
  presenceExpiresIn: z.number().int().positive(),
  newBadges: z.array(EarnedBadgeSchema),
  streak: StoreStreakSchema.nullable(),
  eligibleOffers: z.array(z.object({
    id: IdSchema,
    type: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    terms: z.string().nullable(),
    redemptionCode: z.string(),
  })),
});
export type CheckinResult = z.infer<typeof CheckinResultSchema>;

export const SetHomeStoreSchema = z.object({
  storeId: IdSchema.nullable(),
});
export type SetHomeStore = z.infer<typeof SetHomeStoreSchema>;

// --- Presence ---

export const HeartbeatBodySchema = z.object({
  storeId: IdSchema,
});
export type HeartbeatBody = z.infer<typeof HeartbeatBodySchema>;

export const HeartbeatResponseSchema = z.object({
  storeId: IdSchema,
  storeName: z.string(),
  expiresIn: z.number().int().positive(),
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponseSchema>;

// --- Events ---

export const EventSourceSchema = z.enum(['STORE', 'DISCORD', 'WIZARDS']);
export type EventSource = z.infer<typeof EventSourceSchema>;

export const StoreEventSchema = z.object({
  id: IdSchema,
  name: z.string(),
  source: EventSourceSchema,
  description: z.string().nullable(),
  url: z.string().url().nullable(),
  eventChannelUrl: z.string().nullable(),
  startsAt: TimestampSchema,
  endsAt: TimestampSchema.nullable(),
  formatName: z.string().nullable(),
  formatSlug: z.string().nullable(),
  attendeeCount: z.number().int().nonnegative(),
  isAttending: z.boolean(),
});
export type StoreEvent = z.infer<typeof StoreEventSchema>;

export const StoreEventsDaySchema = z.object({
  date: z.string(),
  events: z.array(StoreEventSchema),
});
export type StoreEventsDay = z.infer<typeof StoreEventsDaySchema>;

export const StoreEventsResponseSchema = z.array(StoreEventsDaySchema);
export type StoreEventsResponse = z.infer<typeof StoreEventsResponseSchema>;

export const AttendEventResponseSchema = z.object({
  eventId: IdSchema,
  eventName: z.string(),
});
export type AttendEventResponse = z.infer<typeof AttendEventResponseSchema>;

// --- Encounters ---

export const EncounterSourceSchema = z.enum(['PRESENCE', 'CONNECTION', 'GAME']);
export type EncounterSource = z.infer<typeof EncounterSourceSchema>;

export const EncounterItemSchema = z.object({
  id: IdSchema,
  source: EncounterSourceSchema,
  peer: PublicProfileSchema,
  storeId: IdSchema.nullable(),
  storeName: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type EncounterItem = z.infer<typeof EncounterItemSchema>;

export const EncountersResponseSchema = z.object({
  encounters: z.array(EncounterItemSchema),
  crossedPathsCount: z.number().int().nonnegative(),
});
export type EncountersResponse = z.infer<typeof EncountersResponseSchema>;

// --- Discovery ---

export const SharedEventSummarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  startsAt: TimestampSchema,
});
export type SharedEventSummary = z.infer<typeof SharedEventSummarySchema>;

export const NearbyPlayerSchema = PublicProfileSchema.extend({
  metBefore: z.boolean(),
  lastMetStoreName: z.string().nullable(),
  sharedEvent: SharedEventSummarySchema.nullable(),
});
export type NearbyPlayer = z.infer<typeof NearbyPlayerSchema>;

export const NearbyResponseSchema = z.object({
  storeId: IdSchema.nullable(),
  storeName: z.string().nullable(),
  players: z.array(NearbyPlayerSchema),
});
export type NearbyResponse = z.infer<typeof NearbyResponseSchema>;

// --- Advanced discovery ---

export const NearbyFiltersSchema = z.object({
  format: MtgFormatSchema.optional(),
  colors: z.string().optional(), // comma-separated WUBRG, e.g. "W,U"
  powerMin: z.coerce.number().int().min(1).max(10).optional(),
  powerMax: z.coerce.number().int().min(1).max(10).optional(),
  vibe: PlayerVibeSchema.optional(),
});
export type NearbyFilters = z.infer<typeof NearbyFiltersSchema>;

export const MatchReasonTypeSchema = z.enum([
  'shared_format',
  'similar_power',
  'color_overlap',
  'positive_encounter',
  'compatible_vibe',
  'new_connection',
]);
export type MatchReasonType = z.infer<typeof MatchReasonTypeSchema>;

export const MatchReasonSchema = z.object({
  type: MatchReasonTypeSchema,
  label: z.string(),
});
export type MatchReason = z.infer<typeof MatchReasonSchema>;

export const SuggestionSchema = NearbyPlayerSchema.extend({
  score: z.number(),
  reasons: z.array(MatchReasonSchema),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const SuggestionsResponseSchema = z.object({
  storeId: IdSchema.nullable(),
  storeName: z.string().nullable(),
  suggestions: z.array(SuggestionSchema),
});
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;

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
  codeVerifier: z.string().optional(),
  redirectUri: z.string().url().optional(),
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

// --- Partner program ---

export const UserRoleSchema = z.enum(['USER', 'PARTNER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const OfferTypeSchema = z.enum(['FIRST_VISIT', 'STREAK']);
export type OfferType = z.infer<typeof OfferTypeSchema>;

export const RewardOfferSchema = z.object({
  id: IdSchema,
  storeId: IdSchema,
  type: OfferTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  terms: z.string().nullable(),
  active: z.boolean(),
  streakRequired: z.number().int().nullable(),
  startsAt: TimestampSchema.nullable(),
  endsAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});
export type RewardOffer = z.infer<typeof RewardOfferSchema>;

export const ActiveOfferSchema = RewardOfferSchema.extend({
  redemptionCode: z.string().optional(), // only present when user has checked in
});
export type ActiveOffer = z.infer<typeof ActiveOfferSchema>;

export const CreateRewardOfferSchema = z.object({
  type: OfferTypeSchema,
  title: z.string().min(1).max(128),
  description: z.string().max(500).nullable().optional(),
  terms: z.string().max(500).nullable().optional(),
  streakRequired: z.number().int().min(2).max(52).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});
export type CreateRewardOffer = z.infer<typeof CreateRewardOfferSchema>;

export const UpdateRewardOfferSchema = CreateRewardOfferSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateRewardOffer = z.infer<typeof UpdateRewardOfferSchema>;

export const StoreOwnershipSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  storeId: IdSchema,
  createdAt: TimestampSchema,
});
export type StoreOwnership = z.infer<typeof StoreOwnershipSchema>;

export const ClaimStoreSchema = z.object({
  storeId: IdSchema,
});
export type ClaimStore = z.infer<typeof ClaimStoreSchema>;

export const UpdateStoreProfileSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  address: z.string().max(256).nullable().optional(),
  city: z.string().max(64).nullable().optional(),
  state: z.string().max(64).nullable().optional(),
  zip: z.string().max(16).nullable().optional(),
  discordUrl: z.string().url().nullable().optional(),
});
export type UpdateStoreProfile = z.infer<typeof UpdateStoreProfileSchema>;

// --- Safety ---

export const ReportReasonSchema = z.enum([
  'HARASSMENT',
  'SPAM',
  'FAKE_PROFILE',
  'INAPPROPRIATE',
  'OTHER',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const BlockBodySchema = z.object({
  userId: IdSchema,
});
export type BlockBody = z.infer<typeof BlockBodySchema>;

export const ReportBodySchema = z.object({
  userId: IdSchema,
  reason: ReportReasonSchema,
  detail: z.string().max(1000).optional(),
  context: z.string().max(256).optional(),
});
export type ReportBody = z.infer<typeof ReportBodySchema>;

export const BlockedUserSchema = z.object({
  id: z.string(),
  userId: IdSchema,
  displayName: z.string(),
  avatarColors: z.array(z.string()),
});
export type BlockedUser = z.infer<typeof BlockedUserSchema>;

export const PartnerAnalyticsSchema = z.object({
  totalCheckins: z.number().int(),
  checkinsThisWeek: z.number().int(),
  checkinsThisMonth: z.number().int(),
  uniqueVisitors: z.number().int(),
  activeOffers: z.number().int(),
});
export type PartnerAnalytics = z.infer<typeof PartnerAnalyticsSchema>;
