import { z } from 'zod';

export * from './legal';

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
  'influencer',
]);
export type PlayerVibe = z.infer<typeof PlayerVibeSchema>;

export const DeckSiteSchema = z.enum(['moxfield', 'archidekt']);
export type DeckSite = z.infer<typeof DeckSiteSchema>;

export const DECK_SITE_HOSTS: Record<DeckSite, string> = {
  moxfield: 'moxfield.com',
  archidekt: 'archidekt.com',
};

// --- Social links ---

export const SocialPlatformSchema = z.enum([
  'DISCORD',
  'INSTAGRAM',
  'TWITCH',
  'YOUTUBE',
  'X',
  'TIKTOK',
  'FACEBOOK',
  'BLUESKY',
  'WEBSITE',
  'PHONE',
  'EMAIL',
]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const SocialVisibilitySchema = z.enum(['PUBLIC', 'FRIENDS', 'HIDDEN']);
export type SocialVisibility = z.infer<typeof SocialVisibilitySchema>;

export const SocialLinkSchema = z.object({
  id: IdSchema,
  platform: SocialPlatformSchema,
  value: z.string(),
  visibility: SocialVisibilitySchema,
  sort: z.number().int(),
});
export type SocialLink = z.infer<typeof SocialLinkSchema>;

export const SocialLinkInputSchema = z.object({
  platform: SocialPlatformSchema,
  value: z.string().min(1).max(256),
  visibility: SocialVisibilitySchema.optional(),
});
export type SocialLinkInput = z.infer<typeof SocialLinkInputSchema>;

export const UpdateSocialLinkSchema = z.object({
  value: z.string().min(1).max(256).optional(),
  visibility: SocialVisibilitySchema.optional(),
});
export type UpdateSocialLink = z.infer<typeof UpdateSocialLinkSchema>;

export const ReorderSocialLinksSchema = z.object({
  order: z.array(IdSchema).min(1),
});
export type ReorderSocialLinks = z.infer<typeof ReorderSocialLinksSchema>;

export const SocialsSummarySchema = z.object({
  publicCount: z.number().int().nonnegative(),
  friendsOnlyCount: z.number().int().nonnegative(),
});
export type SocialsSummary = z.infer<typeof SocialsSummarySchema>;

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
  vibes: z.array(PlayerVibeSchema).optional(),
  formats: z.array(MtgFormatSchema),
  homeStoreName: z.string().nullable().optional(),
  socials: z.array(SocialLinkSchema).optional(),
  socialsSummary: SocialsSummarySchema.optional(),
  spelltable: z.boolean().optional(),
  convokeGames: z.boolean().optional(),
  tradeWants: z.string().nullable().optional(),
  tradeHaves: z.string().nullable().optional(),
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

// --- Endorsements ---

export const EndorsementTagSchema = z.enum([
  'GREAT_HOST',
  'GOOD_SPORT',
  'TAUGHT_THE_FORMAT',
  'FAST_PLAYER',
  'WELL_BREWED_DECK',
  'GENEROUS',
]);
export type EndorsementTag = z.infer<typeof EndorsementTagSchema>;

export const EndorseInputSchema = z.object({
  toUserId: IdSchema,
  tag: EndorsementTagSchema,
});
export type EndorseInput = z.infer<typeof EndorseInputSchema>;

export const EndorsementTagCountSchema = z.object({
  tag: EndorsementTagSchema,
  count: z.number().int().nonnegative(),
});
export type EndorsementTagCount = z.infer<typeof EndorsementTagCountSchema>;

export const EndorsementSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  byTag: z.array(EndorsementTagCountSchema),
});
export type EndorsementSummary = z.infer<typeof EndorsementSummarySchema>;

// --- Profile ---

export const ProfileSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  name: z.string().max(80).nullable(),
  displayName: z.string().min(1).max(64),
  pronouns: z.string().max(32).nullable(),
  bio: z.string().max(500).nullable(),
  avatarColors: z.array(ManaColorSchema),
  commander: z.string().max(128).nullable(),
  powerLevel: z.number().int().min(1).max(10).nullable(),
  vibes: z.array(PlayerVibeSchema).optional(),
  formats: z.array(MtgFormatSchema),
  spelltable: z.boolean().optional(),
  convokeGames: z.boolean().optional(),
  createdAt: TimestampSchema,
  onboardedAt: z.string().datetime().nullable(),
  lastLat: z.number().nullable().optional(),
  lastLng: z.number().nullable().optional(),
  tradeWants: z.string().nullable().optional(),
  tradeHaves: z.string().nullable().optional(),
  endorsements: EndorsementSummarySchema.optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z.object({
  name: z.string().max(80).nullable().optional(),
  displayName: z.string().min(1).max(64).optional(),
  pronouns: z.string().max(32).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarColors: z.array(ManaColorSchema).max(5).optional(),
  commander: z.string().max(128).nullable().optional(),
  powerLevel: z.number().int().min(1).max(10).nullable().optional(),
  vibes: z.array(PlayerVibeSchema).optional(),
  formats: z.array(MtgFormatSchema).optional(),
  spelltable: z.boolean().optional(),
  convokeGames: z.boolean().optional(),
  tradeWants: z.string().max(2000).nullable().optional(),
  tradeHaves: z.string().max(2000).nullable().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// --- Privacy ---

export const PrivacySchema = z.object({
  discoverable: z.boolean(),
  showDiscord: z.boolean(),
  showDecks: z.boolean(),
  showMetHistory: z.boolean(),
  storeMessages: z.boolean().default(true),
  shareNameWithContacts: z.boolean().default(false),
  eventReminders: z.boolean().default(true),
});
export type Privacy = z.infer<typeof PrivacySchema>;

export const UpdatePrivacySchema = z.object({
  discoverable: z.boolean().optional(),
  showDiscord: z.boolean().optional(),
  showDecks: z.boolean().optional(),
  showMetHistory: z.boolean().optional(),
  storeMessages: z.boolean().optional(),
  shareNameWithContacts: z.boolean().optional(),
  eventReminders: z.boolean().optional(),
});
export type UpdatePrivacy = z.infer<typeof UpdatePrivacySchema>;

// --- Deck links ---

export function siteFromUrl(url: string): DeckSite | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    for (const [site, expected] of Object.entries(DECK_SITE_HOSTS) as [DeckSite, string][]) {
      if (host === expected || host.endsWith(`.${expected}`)) return site;
    }
  } catch {
    // Not a parseable URL
  }
  return null;
}

export const DeckLinkSchema = z.object({
  id: IdSchema,
  site: DeckSiteSchema.nullable(),
  name: z.string().min(1).max(64),
  url: z.string().url().optional(),
});
export type DeckLink = z.infer<typeof DeckLinkSchema>;

export const CreateDeckLinkSchema = z
  .object({
    name: z.string().min(1).max(64),
    url: z.string().url().optional(),
  })
  .refine((d) => !d.url || siteFromUrl(d.url) !== null, {
    message: 'Only Moxfield or Archidekt URLs are supported',
    path: ['url'],
  });
export type CreateDeckLink = z.infer<typeof CreateDeckLinkSchema>;

export const UpdateDeckLinkSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    url: z.string().url().optional(),
  })
  .refine((d) => !d.url || siteFromUrl(d.url) !== null, {
    message: 'Only Moxfield or Archidekt URLs are supported',
    path: ['url'],
  });
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
  myNote: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  peer: PublicProfileSchema,
});
export type ConnectionItem = z.infer<typeof ConnectionItemSchema>;

export const UpdateConnectionNoteSchema = z.object({
  text: z.string().max(500).nullable(),
});
export type UpdateConnectionNote = z.infer<typeof UpdateConnectionNoteSchema>;

export const ConnectionsListSchema = z.object({
  incoming: z.array(ConnectionItemSchema),
  outgoing: z.array(ConnectionItemSchema),
  accepted: z.array(ConnectionItemSchema),
});
export type ConnectionsList = z.infer<typeof ConnectionsListSchema>;

export const ConnectedProfileSchema = PublicProfileSchema.extend({
  name: z.string().max(80).nullable(),
  discordHandle: z.string().nullable(),
  deckLinks: z.array(DeckLinkSchema),
  endorsements: EndorsementSummarySchema.optional(),
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
  proposed: z.boolean().optional(),
  confirmationCount: z.number().int().nonnegative().optional(),
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

export const WinsLeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: IdSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  avatarColors: z.array(z.string()),
  wins: z.number().int().nonnegative(),
  isMe: z.boolean(),
});
export type WinsLeaderboardEntry = z.infer<typeof WinsLeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  myEntry: z
    .object({
      rank: z.number().int().positive(),
      currentStreak: z.number().int().nonnegative(),
      totalCheckins: z.number().int().nonnegative(),
    })
    .nullable(),
  winsLeaderboard: z
    .object({
      entries: z.array(WinsLeaderboardEntrySchema),
      myEntry: z
        .object({
          rank: z.number().int().positive(),
          wins: z.number().int().nonnegative(),
        })
        .nullable(),
    })
    .optional(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const ActiveEventSchema = z.object({
  id: IdSchema,
  name: z.string(),
  startsAt: TimestampSchema,
  formatName: z.string().nullable(),
});
export type ActiveEvent = z.infer<typeof ActiveEventSchema>;

export const CheckinResultSchema = z.object({
  checkinId: IdSchema,
  storeId: IdSchema,
  storeName: z.string(),
  checkedInAt: TimestampSchema,
  presenceExpiresIn: z.number().int().positive(),
  newBadges: z.array(EarnedBadgeSchema),
  streak: StoreStreakSchema.nullable(),
  eligibleOffers: z.array(
    z.object({
      id: IdSchema,
      type: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      terms: z.string().nullable(),
      redemptionCode: z.string(),
    }),
  ),
  activeEvents: z.array(ActiveEventSchema),
});
export type CheckinResult = z.infer<typeof CheckinResultSchema>;

export const CheckinBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});
export type CheckinBody = z.infer<typeof CheckinBodySchema>;

export const SetHomeStoreSchema = z.object({
  storeId: IdSchema.nullable(),
});
export type SetHomeStore = z.infer<typeof SetHomeStoreSchema>;

// --- Presence ---

export const HeartbeatBodySchema = z.object({
  storeId: IdSchema.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type HeartbeatBody = z.infer<typeof HeartbeatBodySchema>;

export const HeartbeatResponseSchema = z.object({
  storeId: IdSchema.nullable(),
  storeName: z.string().nullable(),
  expiresIn: z.number().int().positive(),
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponseSchema>;

export const NotifyWhenActiveBodySchema = z.object({
  threshold: z.number().int().min(1).max(20).default(2),
});
export type NotifyWhenActiveBody = z.infer<typeof NotifyWhenActiveBodySchema>;

export const NotifyWhenActiveResponseSchema = z.object({
  storeId: IdSchema,
  threshold: z.number().int(),
});
export type NotifyWhenActiveResponse = z.infer<typeof NotifyWhenActiveResponseSchema>;

// --- Events ---

export const EventSourceSchema = z.enum(['STORE']);
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
  hereNowCount: z.number().int().nonnegative(),
});
export type StoreEvent = z.infer<typeof StoreEventSchema>;

export const AssociateCheckinEventBodySchema = z.object({
  eventId: IdSchema,
});
export type AssociateCheckinEventBody = z.infer<typeof AssociateCheckinEventBodySchema>;

export const EventAttendeeEntrySchema = PublicProfileSchema.extend({
  isHereNow: z.boolean(),
});
export type EventAttendeeEntry = z.infer<typeof EventAttendeeEntrySchema>;

export const EventAttendanceResponseSchema = z.object({
  hereNow: z.array(EventAttendeeEntrySchema),
  rsvpd: z.array(EventAttendeeEntrySchema),
  hereNowCount: z.number().int().nonnegative(),
});
export type EventAttendanceResponse = z.infer<typeof EventAttendanceResponseSchema>;

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

export const UnattendEventResponseSchema = z.object({
  eventId: IdSchema,
  eventName: z.string(),
});
export type UnattendEventResponse = z.infer<typeof UnattendEventResponseSchema>;

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

export const GoogleAuthBodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});
export type GoogleAuthBody = z.infer<typeof GoogleAuthBodySchema>;

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
  code: z.string().min(1).max(32).optional(),
  note: z.string().max(1000).optional(),
});
export type ClaimStore = z.infer<typeof ClaimStoreSchema>;

export const ClaimStoreResultSchema = z.object({
  status: z.enum(['APPROVED', 'PENDING']),
  storeId: IdSchema,
  storeName: z.string(),
});
export type ClaimStoreResult = z.infer<typeof ClaimStoreResultSchema>;

export const StoreClaimStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type StoreClaimStatus = z.infer<typeof StoreClaimStatusSchema>;

export const PendingStoreClaimSchema = z.object({
  id: IdSchema,
  storeId: IdSchema,
  storeName: z.string(),
  userId: IdSchema,
  claimantName: z.string(),
  note: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type PendingStoreClaim = z.infer<typeof PendingStoreClaimSchema>;

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

// --- Moderation ---

export const ModerationStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

export const ModerationActionTypeSchema = z.enum(['DISMISS', 'WARN', 'SUSPEND', 'BAN']);
export type ModerationActionType = z.infer<typeof ModerationActionTypeSchema>;

export const ModerationUserSummarySchema = z.object({
  id: IdSchema,
  displayName: z.string(),
  handle: z.string().nullable(),
  avatarColors: z.array(z.string()),
  moderationStatus: ModerationStatusSchema,
  priorReports: z.number().int().nonnegative(),
  priorActions: z.number().int().nonnegative(),
});
export type ModerationUserSummary = z.infer<typeof ModerationUserSummarySchema>;

export const ModerationReportSchema = z.object({
  id: IdSchema,
  reason: ReportReasonSchema,
  context: z.string().nullable(),
  createdAt: TimestampSchema,
  status: z.enum(['OPEN', 'REVIEWED', 'ACTIONED']),
  resolvedAt: TimestampSchema.nullable(),
  resolutionNote: z.string().nullable(),
  reported: ModerationUserSummarySchema,
});
export type ModerationReport = z.infer<typeof ModerationReportSchema>;

export const ModerationSignalSchema = z.object({
  type: z.enum(['open_report', 'prior_action']),
  label: z.string(),
  createdAt: TimestampSchema,
});
export type ModerationSignal = z.infer<typeof ModerationSignalSchema>;

export const ModerationDetailSchema = ModerationReportSchema.extend({
  detail: z.string().nullable(),
  signals: z.array(ModerationSignalSchema),
});
export type ModerationDetail = z.infer<typeof ModerationDetailSchema>;

export const ResolveReportSchema = z.object({
  action: ModerationActionTypeSchema,
  note: z.string().max(1000).optional(),
  suspendDays: z.number().int().min(1).max(365).optional(),
});
export type ResolveReport = z.infer<typeof ResolveReportSchema>;

export const ModerationStatsSchema = z.object({
  open: z.number().int().nonnegative(),
  repeatOffenders: z.number().int().nonnegative(),
  reviewed: z.number().int().nonnegative(),
  actionedAllTime: z.number().int().nonnegative(),
});
export type ModerationStats = z.infer<typeof ModerationStatsSchema>;

// --- LFG ---

export const LfgDurationSchema = z.union([z.literal(30), z.literal(60), z.literal(120)]);
export type LfgDuration = z.infer<typeof LfgDurationSchema>;

export const LfgSessionSchema = z.object({
  storeId: IdSchema,
  format: MtgFormatSchema.nullable(),
  power: z.number().int().min(1).max(10),
  seats: z.number().int().min(1).max(3),
  durationMins: LfgDurationSchema,
  note: z.string().max(140).nullable(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
});
export type LfgSession = z.infer<typeof LfgSessionSchema>;

export const CreateLfgSchema = z.object({
  format: MtgFormatSchema.nullable().optional(),
  power: z.number().int().min(1).max(10),
  seats: z.number().int().min(1).max(3),
  durationMins: LfgDurationSchema,
  note: z.string().max(140).nullable().optional(),
});
export type CreateLfg = z.infer<typeof CreateLfgSchema>;

export const UpdateLfgSchema = z.object({
  format: MtgFormatSchema.nullable().optional(),
  power: z.number().int().min(1).max(10).optional(),
  seats: z.number().int().min(1).max(3).optional(),
  durationMins: LfgDurationSchema.optional(),
  note: z.string().max(140).nullable().optional(),
});
export type UpdateLfg = z.infer<typeof UpdateLfgSchema>;

export const LfgFeedItemSchema = PublicProfileSchema.extend({
  session: LfgSessionSchema,
  minutesLeft: z.number().int(),
  metBefore: z.boolean(),
});
export type LfgFeedItem = z.infer<typeof LfgFeedItemSchema>;

export const LfgLockBodySchema = z.object({
  memberIds: z.array(IdSchema).min(1).max(3),
});
export type LfgLockBody = z.infer<typeof LfgLockBodySchema>;

// --- Onboarding ---

export const OnboardingDeckSchema = CreateDeckLinkSchema;

export const OnboardingSubmitSchema = z.object({
  name: z.string().max(80).nullable().optional(),
  shareNameWithContacts: z.boolean().optional(),
  displayName: z.string().min(1).max(64),
  pronouns: z.string().max(32).nullable().optional(),
  avatarColors: z.array(ManaColorSchema).min(1).max(5),
  formats: z.array(MtgFormatSchema).min(1),
  commander: z.string().max(128).nullable().optional(),
  powerLevel: z.number().int().min(1).max(10).nullable().optional(),
  vibes: z.array(PlayerVibeSchema).optional(),
  bio: z.string().max(500).nullable().optional(),
  discoverable: z.boolean().optional(),
  decks: z.array(OnboardingDeckSchema).max(10).optional(),
  homeStoreId: IdSchema.optional(),
});
export type OnboardingSubmit = z.infer<typeof OnboardingSubmitSchema>;

// --- Pods ---

export const PodToleranceSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type PodTolerance = z.infer<typeof PodToleranceSchema>;

export const PodFitTierSchema = z.enum(['great', 'close', 'off']);
export type PodFitTier = z.infer<typeof PodFitTierSchema>;

export const PodFitSchema = z.object({
  tier: PodFitTierSchema,
  label: z.string(),
});
export type PodFit = z.infer<typeof PodFitSchema>;

export const CreatePodSchema = z.object({
  format: MtgFormatSchema.nullable().optional(),
  targetPower: z.number().int().min(1).max(10),
  tolerance: PodToleranceSchema,
  seats: z.number().int().min(2).max(4),
  where: z.string().min(1).max(40),
  note: z.string().max(140).nullable().optional(),
});
export type CreatePod = z.infer<typeof CreatePodSchema>;

export const PodFeedItemSchema = z.object({
  id: IdSchema,
  hostId: IdSchema,
  storeId: IdSchema,
  format: MtgFormatSchema.nullable(),
  targetPower: z.number().int().min(1).max(10),
  tolerance: PodToleranceSchema,
  seats: z.number().int().min(2).max(4),
  seatsOpen: z.number().int().min(0),
  where: z.string().max(40),
  note: z.string().max(140).nullable(),
  host: PublicProfileSchema,
  fit: PodFitSchema,
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
});
export type PodFeedItem = z.infer<typeof PodFeedItemSchema>;

export const PodCandidateSchema = PublicProfileSchema.extend({
  fit: PodFitSchema,
});
export type PodCandidate = z.infer<typeof PodCandidateSchema>;

export const PodDetailSchema = PodFeedItemSchema.extend({
  members: z.array(PublicProfileSchema),
  requests: z.array(PublicProfileSchema),
  candidates: z.array(PodCandidateSchema),
  hasRequested: z.boolean(),
});
export type PodDetail = z.infer<typeof PodDetailSchema>;

export const PodMemberActionSchema = z.object({
  userId: IdSchema,
});
export type PodMemberAction = z.infer<typeof PodMemberActionSchema>;

// --- Games ---

export const GameStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'DISPUTED']);
export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GamePlayerSchema = z.object({
  userId: IdSchema,
  displayName: z.string(),
  avatarColors: z.array(z.string()),
  deck: z.string().nullable(),
  confirmed: z.boolean(),
});
export type GamePlayer = z.infer<typeof GamePlayerSchema>;

export const GameSchema = z.object({
  id: IdSchema,
  status: GameStatusSchema,
  storeId: IdSchema.nullable(),
  storeName: z.string().nullable(),
  format: z.string().nullable(),
  winnerId: IdSchema,
  winnerName: z.string(),
  note: z.string().nullable(),
  players: z.array(GamePlayerSchema),
  createdAt: TimestampSchema,
  confirmedAt: TimestampSchema.nullable(),
});
export type Game = z.infer<typeof GameSchema>;

export const CreateGameSchema = z.object({
  storeId: IdSchema.optional(),
  format: MtgFormatSchema.optional(),
  winnerId: z.string().min(1).max(100),
  players: z
    .array(z.object({ userId: z.string().min(1).max(100), deck: z.string().max(128).optional() }))
    .min(2)
    .max(4),
  note: z.string().max(500).optional(),
});
export type CreateGame = z.infer<typeof CreateGameSchema>;

export const DeckStatSchema = z.object({
  deck: z.string(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1),
});
export type DeckStat = z.infer<typeof DeckStatSchema>;

export const GameStatsSchema = z.object({
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(1),
  byDeck: z.array(DeckStatSchema),
});
export type GameStats = z.infer<typeof GameStatsSchema>;

// --- Broadcast ---

export const BroadcastAudienceSchema = z.enum([
  'CHECKED_IN_NOW',
  'TODAY',
  'EVENT_RSVPS',
  'RECENT_30D',
]);
export type BroadcastAudience = z.infer<typeof BroadcastAudienceSchema>;

export const SendBroadcastSchema = z.object({
  audience: BroadcastAudienceSchema,
  title: z.string().min(1).max(40),
  body: z.string().min(1).max(140),
  eventId: z.string().optional(),
});
export type SendBroadcast = z.infer<typeof SendBroadcastSchema>;

export const BroadcastSchema = z.object({
  id: z.string(),
  audience: BroadcastAudienceSchema,
  title: z.string(),
  body: z.string(),
  eventId: z.string().nullable(),
  recipientCount: z.number(),
  createdAt: z.string(),
});
export type Broadcast = z.infer<typeof BroadcastSchema>;

export const AudienceCountsSchema = z.object({
  CHECKED_IN_NOW: z.number(),
  TODAY: z.number(),
  EVENT_RSVPS: z.object({
    count: z.number(),
    eventId: z.string().nullable(),
    eventName: z.string().nullable(),
  }),
  RECENT_30D: z.number(),
});
export type AudienceCounts = z.infer<typeof AudienceCountsSchema>;

// --- Offer redemptions ---

export const RedemptionStatusSchema = z.enum(['PENDING', 'REDEEMED', 'VOID']);
export type RedemptionStatus = z.infer<typeof RedemptionStatusSchema>;

export const ClaimOfferResponseSchema = z.object({
  code: z.string().length(8),
  offerId: IdSchema,
  offerTitle: z.string(),
  status: RedemptionStatusSchema,
});
export type ClaimOfferResponse = z.infer<typeof ClaimOfferResponseSchema>;

export const RedeemCodeSchema = z.object({
  code: z.string().length(8),
});
export type RedeemCode = z.infer<typeof RedeemCodeSchema>;

export const RedemptionResultSchema = z.object({
  id: IdSchema,
  code: z.string().length(8),
  status: RedemptionStatusSchema,
  offer: z.object({ id: IdSchema, title: z.string(), type: OfferTypeSchema }),
  player: PublicProfileSchema,
  qualifyingReason: z.string(),
  createdAt: TimestampSchema,
  redeemedAt: TimestampSchema.nullable(),
});
export type RedemptionResult = z.infer<typeof RedemptionResultSchema>;

export const RedemptionListItemSchema = z.object({
  id: IdSchema,
  code: z.string(),
  status: RedemptionStatusSchema,
  offerTitle: z.string(),
  offerType: OfferTypeSchema,
  player: z.object({
    id: IdSchema,
    displayName: z.string(),
    avatarColors: z.array(z.string()),
  }),
  createdAt: TimestampSchema,
  redeemedAt: TimestampSchema.nullable(),
});
export type RedemptionListItem = z.infer<typeof RedemptionListItemSchema>;

// --- Notifications ---

export const NotificationKindSchema = z.enum([
  'CONNECT_REQUEST',
  'CONNECT_ACCEPTED',
  'NEARBY',
  'POD',
  'GAME_CONFIRM',
  'EVENT_REMINDER',
  'BROADCAST',
  'QUEST',
  'PLAY_INVITE',
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationSchema = z.object({
  id: IdSchema,
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).nullable(),
  readAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;

export const MarkReadBodySchema = z.object({
  ids: z.array(IdSchema).optional(),
});
export type MarkReadBody = z.infer<typeof MarkReadBodySchema>;

export const NotificationsPageSchema = z.object({
  items: z.array(NotificationSchema),
  nextCursor: TimestampSchema.nullable(),
});
export type NotificationsPage = z.infer<typeof NotificationsPageSchema>;

// --- Partner event management ---

export const FormatItemSchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: z.string(),
});
export type FormatItem = z.infer<typeof FormatItemSchema>;

export const PartnerEventSchema = z.object({
  id: IdSchema,
  name: z.string(),
  source: EventSourceSchema,
  description: z.string().nullable(),
  formatId: z.string().nullable(),
  formatName: z.string().nullable(),
  startsAt: TimestampSchema,
  endsAt: TimestampSchema.nullable(),
  eventChannelUrl: z.string().nullable(),
  attendeeCount: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
});
export type PartnerEvent = z.infer<typeof PartnerEventSchema>;

export const EVENT_RECURRENCE_WEEKS = 12;

export const CreateEventSchema = z
  .object({
    name: z.string().min(1).max(256),
    formatId: z.string().uuid().optional(),
    description: z.string().max(2000).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    eventChannelUrl: z.string().url().optional(),
    repeatWeekly: z.boolean().optional(),
  })
  .refine((d) => !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });
export type CreateEvent = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    formatId: z.string().uuid().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    eventChannelUrl: z.string().url().nullable().optional(),
  })
  .refine(
    (d) => {
      if (d.startsAt && d.endsAt) return new Date(d.endsAt) > new Date(d.startsAt);
      return true;
    },
    { message: 'endsAt must be after startsAt', path: ['endsAt'] },
  );
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;

// --- Rivalries ---

export const RivalrySchema = z.object({
  opponentId: IdSchema,
  displayName: z.string(),
  pronouns: z.string().nullable(),
  bio: z.string().nullable(),
  avatarColors: z.array(ManaColorSchema),
  commander: z.string().nullable(),
  powerLevel: z.number().int().nullable(),
  vibe: PlayerVibeSchema.nullable(),
  formats: z.array(MtgFormatSchema),
  gamesTogether: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  record: z.string(),
  lastPlayedAt: TimestampSchema,
  hot: z.boolean(),
});
export type Rivalry = z.infer<typeof RivalrySchema>;

// --- Quests ---

export const QuestCriteriaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meet_new_players'), count: z.number().int().positive() }),
  z.object({ type: z.literal('new_store') }),
  z.object({ type: z.literal('play_games'), count: z.number().int().positive() }),
  z.object({ type: z.literal('checkin_streak'), length: z.number().int().positive() }),
  z.object({ type: z.literal('unique_stores'), count: z.number().int().positive() }),
]);
export type QuestCriteria = z.infer<typeof QuestCriteriaSchema>;

export const QuestRewardBadgeSchema = z.object({
  id: IdSchema,
  code: z.string(),
  name: z.string(),
  icon: z.string(),
});
export type QuestRewardBadge = z.infer<typeof QuestRewardBadgeSchema>;

export const QuestSchema = z.object({
  id: IdSchema,
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string(),
  period: z.enum(['MONTHLY']),
  activeFrom: TimestampSchema,
  activeTo: TimestampSchema,
  rewardBadge: QuestRewardBadgeSchema.nullable(),
});
export type Quest = z.infer<typeof QuestSchema>;

export const ActiveQuestSchema = z.object({
  quest: QuestSchema,
  progress: z.number().int().nonnegative(),
  goal: z.number().int().positive(),
  completed: z.boolean(),
});
export type ActiveQuest = z.infer<typeof ActiveQuestSchema>;

// --- Life Tracker ---

export const TrackerCounterSchema = z.enum(['poison', 'energy', 'experience']);
export type TrackerCounter = z.infer<typeof TrackerCounterSchema>;

export const TrackerPlayerSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarColors: z.array(z.string()),
  life: z.number().int(),
  poison: z.number().int().min(0),
  energy: z.number().int().min(0),
  experience: z.number().int().min(0),
  commanderDamage: z.record(z.string(), z.number().int().min(0)),
  commanderCastCount: z.number().int().min(0),
  isEliminated: z.boolean(),
  hasCitysBlessing: z.boolean(),
});
export type TrackerPlayer = z.infer<typeof TrackerPlayerSchema>;

export const TrackerStateSchema = z.object({
  podId: z.string(),
  format: z.string().nullable(),
  startingLife: z.number().int().positive(),
  turnNumber: z.number().int().min(1),
  activePlayerId: z.string().nullable(),
  monarchId: z.string().nullable(),
  initiativeId: z.string().nullable(),
  players: z.array(TrackerPlayerSchema),
  createdAt: z.string().datetime(),
});
export type TrackerState = z.infer<typeof TrackerStateSchema>;

export const LifeDeltaPayloadSchema = z.object({
  targetUserId: z.string(),
  delta: z.number().int(),
  note: z.string().optional(),
});
export type LifeDeltaPayload = z.infer<typeof LifeDeltaPayloadSchema>;

export const CommanderDamagePayloadSchema = z.object({
  targetUserId: z.string(),
  sourceUserId: z.string(),
  delta: z.number().int(),
});
export type CommanderDamagePayload = z.infer<typeof CommanderDamagePayloadSchema>;

export const CounterDeltaPayloadSchema = z.object({
  targetUserId: z.string(),
  counter: TrackerCounterSchema,
  delta: z.number().int(),
});
export type CounterDeltaPayload = z.infer<typeof CounterDeltaPayloadSchema>;

export const SetTokenPayloadSchema = z.object({
  token: z.enum(['monarch', 'initiative', 'citysBlessing']),
  userId: z.string().nullable(),
});
export type SetTokenPayload = z.infer<typeof SetTokenPayloadSchema>;

export const EliminatePayloadSchema = z.object({
  userId: z.string(),
  eliminated: z.boolean(),
});
export type EliminatePayload = z.infer<typeof EliminatePayloadSchema>;

// --- Play online invite ---

export const OnlinePlatformSchema = z.enum(['spelltable', 'convoke']);
export type OnlinePlatform = z.infer<typeof OnlinePlatformSchema>;

export const PlayOnlineInviteSchema = z.object({
  platform: OnlinePlatformSchema,
  roomLink: z.string().min(1).max(512),
  connectionIds: z.array(z.string().uuid()).min(1).max(10),
});
export type PlayOnlineInvite = z.infer<typeof PlayOnlineInviteSchema>;

// --- Store submissions ---

export const StoreStatusSchema = z.enum(['PROPOSED', 'ACTIVE', 'REJECTED']);
export type StoreStatus = z.infer<typeof StoreStatusSchema>;

export const SuggestStoreSchema = z.object({
  name: z.string().min(1).max(128),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(256).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  website: z.string().url().max(512).optional(),
  submitterLat: z.number().min(-90).max(90).optional(),
  submitterLng: z.number().min(-180).max(180).optional(),
  note: z.string().max(512).optional(),
});
export type SuggestStore = z.infer<typeof SuggestStoreSchema>;

export const ConfirmStoreSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type ConfirmStore = z.infer<typeof ConfirmStoreSchema>;

export const StoreConfirmResultSchema = z.object({
  confirmationCount: z.number().int().nonnegative(),
  status: StoreStatusSchema,
});
export type StoreConfirmResult = z.infer<typeof StoreConfirmResultSchema>;

// --- Account data export & deletion (GDPR / CCPA) ---

export const DeleteAccountSchema = z.object({
  confirm: z.literal(true),
});
export type DeleteAccount = z.infer<typeof DeleteAccountSchema>;

export const AccountExportCheckinSchema = z.object({
  id: IdSchema,
  storeId: IdSchema,
  storeName: z.string(),
  eventId: IdSchema.nullable(),
  checkedInAt: TimestampSchema,
  checkedOutAt: TimestampSchema.nullable(),
});

export const AccountExportStreakSchema = z.object({
  storeId: IdSchema,
  storeName: z.string(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  totalCheckins: z.number().int(),
  lastCheckinAt: TimestampSchema,
});

export const AccountExportEventAttendanceSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  eventName: z.string(),
  rsvpAt: TimestampSchema,
});

export const AccountExportConnectionSchema = z.object({
  id: IdSchema,
  otherUserId: IdSchema,
  otherUserName: z.string(),
  direction: z.enum(['sent', 'received']),
  status: ConnectionStatusSchema,
  createdAt: TimestampSchema,
});

export const AccountExportEncounterSchema = z.object({
  id: IdSchema,
  opponentId: IdSchema,
  opponentName: z.string(),
  result: z.enum(['WIN', 'LOSS', 'DRAW']),
  storeId: IdSchema.nullable(),
  createdAt: TimestampSchema,
});

export const AccountExportGameSchema = z.object({
  id: IdSchema,
  storeId: IdSchema.nullable(),
  format: z.string().nullable(),
  status: GameStatusSchema,
  isWinner: z.boolean(),
  deck: z.string().nullable(),
  createdAt: TimestampSchema,
});

export const AccountExportEndorsementSchema = z.object({
  id: IdSchema,
  otherUserId: IdSchema,
  otherUserName: z.string(),
  tag: EndorsementTagSchema,
  createdAt: TimestampSchema,
});

export const AccountExportRedemptionSchema = z.object({
  id: IdSchema,
  storeId: IdSchema,
  storeName: z.string(),
  code: z.string(),
  status: RedemptionStatusSchema,
  createdAt: TimestampSchema,
  redeemedAt: TimestampSchema.nullable(),
});

export const AccountExportReportSchema = z.object({
  id: IdSchema,
  reportedUserId: IdSchema,
  reason: ReportReasonSchema,
  detail: z.string().nullable(),
  status: z.enum(['OPEN', 'REVIEWED', 'ACTIONED']),
  createdAt: TimestampSchema,
});

export const AccountExportBlockSchema = z.object({
  blockedUserId: IdSchema,
  createdAt: TimestampSchema,
});

export const AccountExportSchema = z.object({
  exportedAt: TimestampSchema,
  profile: ProfileSchema,
  privacy: PrivacySchema,
  decks: z.array(DeckLinkSchema),
  socialLinks: z.array(SocialLinkSchema),
  badges: z.array(UserBadgeSchema),
  streaks: z.array(AccountExportStreakSchema),
  checkins: z.array(AccountExportCheckinSchema),
  eventAttendance: z.array(AccountExportEventAttendanceSchema),
  connections: z.array(AccountExportConnectionSchema),
  encounters: z.array(AccountExportEncounterSchema),
  games: z.array(AccountExportGameSchema),
  endorsementsGiven: z.array(AccountExportEndorsementSchema),
  endorsementsReceived: z.array(AccountExportEndorsementSchema),
  offerRedemptions: z.array(AccountExportRedemptionSchema),
  blocksMade: z.array(AccountExportBlockSchema),
  reportsMade: z.array(AccountExportReportSchema),
});
export type AccountExport = z.infer<typeof AccountExportSchema>;

// --- Admin: direct user lookup & moderation ---

export const AdminUserActionSchema = z.object({
  action: z.enum(['WARN', 'SUSPEND', 'BAN', 'UNBAN']),
  note: z.string().max(1000).optional(),
  suspendDays: z.number().int().min(1).max(365).optional(),
});
export type AdminUserAction = z.infer<typeof AdminUserActionSchema>;

export const AdminUpdateUserSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  role: UserRoleSchema.optional(),
});
export type AdminUpdateUser = z.infer<typeof AdminUpdateUserSchema>;

export const AdminUserSummarySchema = z.object({
  id: IdSchema,
  displayName: z.string(),
  email: z.string().email(),
  handle: z.string().nullable(),
  role: UserRoleSchema,
  moderationStatus: ModerationStatusSchema,
  avatarColors: z.array(z.string()),
  isBot: z.boolean(),
});
export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;

export const AdminUserIdentitySchema = z.object({
  provider: z.string(),
  discordHandle: z.string().nullable(),
});
export type AdminUserIdentity = z.infer<typeof AdminUserIdentitySchema>;

export const AdminUserModerationHistoryEntrySchema = z.object({
  id: IdSchema,
  action: z.enum(['DISMISS', 'WARN', 'SUSPEND', 'BAN', 'UNBAN']),
  note: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type AdminUserModerationHistoryEntry = z.infer<
  typeof AdminUserModerationHistoryEntrySchema
>;

export const AdminUserReportSchema = z.object({
  id: IdSchema,
  reason: ReportReasonSchema,
  status: z.enum(['OPEN', 'REVIEWED', 'ACTIONED']),
  createdAt: TimestampSchema,
});
export type AdminUserReport = z.infer<typeof AdminUserReportSchema>;

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  suspendedUntil: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  identities: z.array(AdminUserIdentitySchema),
  storeOwnerships: z.array(z.object({ storeId: IdSchema, storeName: z.string() })),
  counts: z.object({
    checkins: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    gamesPlayed: z.number().int().nonnegative(),
  }),
  reportsAgainst: z.array(AdminUserReportSchema),
  moderationHistory: z.array(AdminUserModerationHistoryEntrySchema),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

// --- Admin: direct store lookup & management ---

export const AdminStoreSummarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  status: StoreStatusSchema,
  ownerCount: z.number().int().nonnegative(),
});
export type AdminStoreSummary = z.infer<typeof AdminStoreSummarySchema>;

export const AdminStoreOwnerSchema = z.object({
  userId: IdSchema,
  displayName: z.string(),
  email: z.string().email(),
});
export type AdminStoreOwner = z.infer<typeof AdminStoreOwnerSchema>;

export const AdminStoreDetailSchema = z.object({
  id: IdSchema,
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  website: z.string().nullable(),
  discordUrl: z.string().nullable(),
  status: StoreStatusSchema,
  owners: z.array(AdminStoreOwnerSchema),
  counts: z.object({
    activeOffers: z.number().int().nonnegative(),
    checkins: z.number().int().nonnegative(),
    upcomingEvents: z.number().int().nonnegative(),
  }),
});
export type AdminStoreDetail = z.infer<typeof AdminStoreDetailSchema>;
