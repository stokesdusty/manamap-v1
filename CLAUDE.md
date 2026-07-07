# ManaMap — Claude Context

## What is this?

ManaMap is a social/location app for Magic: The Gathering players. Players check in to local game stores, track streaks and badges, discover nearby players, form pods and play games (in-person or via SpellTable/Convoke), track life totals in real time, complete quests, and build rivalries. Store owners use a web portal to manage reward offers, events, and player broadcasts. It is a pnpm monorepo.

---

## Repo structure

```
apps/
  api/      — NestJS + Fastify backend (TypeScript)
  mobile/   — Expo React Native app (TypeScript)
  admin/    — Vite + React web portal for store owners (TypeScript)
packages/
  shared/   — Zod schemas shared between API and mobile
```

Run everything from the repo root with `pnpm`.

---

## Apps

### `apps/api` — NestJS API

- **Runtime**: NestJS on Fastify, port 3000
- **URL prefix**: `/api` — all routes are `/api/v1/...`
- **Database**: PostgreSQL 16 + PostGIS at `localhost:5432`, db `manamap`
- **Cache**: Redis at `localhost:6379` (presence/nearby/LFG/pods/life-tracker/exchange tokens)
- **ORM**: Prisma — schema at `apps/api/prisma/schema.prisma`
- **Queue**: BullMQ — two queues: `gamification` (badges/streaks after checkin), `event-reminders` (RSVP push reminders)
- **WebSockets**: Socket.IO via a custom `WsAdapter` (`apps/api/src/ws-adapter.ts`), mounted on the same Fastify HTTP server at path `/ws/socket.io` — see the Pods & Life Tracker section below. There is only one HTTP listener (port 3000); no separate WS port is actually opened.
- **Auth**: Discord, Apple, and Google OAuth → JWT access + refresh tokens (`POST /v1/auth/discord|apple|google`)
  - Mobile uses PKCE with custom scheme `manamap://auth/discord` for Discord; native Sign in with Apple/Google on their respective platforms
  - Web (admin portal) uses standard Discord redirect URI with `redirectUri` passed in body
  - `POST /v1/auth/refresh` and `POST /v1/auth/logout` round out the token lifecycle
  - `POST /v1/auth/dev-login { email }` bypasses OAuth entirely for seeded accounts — gated only by `NODE_ENV !== 'production'`, **not** by the `DEV_TOOLS` flag used by the dev harness below
- **JWT payload**: `{ sub: userId, role: UserRole }`
- **Env file**: `apps/api/.env`

Key env vars:
```
DATABASE_URL=postgresql://manamap:manamap@localhost:5432/manamap
REDIS_URL=redis://localhost:6379
API_PORT=3000
API_HOST=localhost
JWT_SECRET=...
DISCORD_CLIENT_ID=1510362228526809199
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=manamap://auth/discord
APPLE_CLIENT_ID=com.manamap.app
GOOGLE_CLIENT_ID=...
ADMIN_EMAILS=stokes.dusty@gmail.com
```

**Modules** (all in `apps/api/src/`):
| Module | Routes |
|---|---|
| auth | POST /v1/auth/discord\|apple\|google, POST /v1/auth/refresh\|logout, POST /v1/auth/dev-login (non-prod only) |
| me | GET/PATCH /v1/me, GET/PATCH /v1/me/privacy, CRUD /v1/me/decks, GET /v1/me/streaks, GET /v1/me/stats (game W/L/winRate/byDeck, computed from GameLog), POST /v1/me/onboarding, GET /v1/me/export, DELETE /v1/me, POST /v1/me/push-token, GET /v1/me/rivalries |
| stores | GET /v1/stores, GET /v1/stores/:id, POST /v1/stores/:id/checkin, GET /v1/stores/:id/offers, GET /v1/stores/:id/events, GET /v1/stores/:id/leaderboard, POST/DELETE /v1/stores/:id/events/:eventId/attend, POST /v1/stores/suggest, POST /v1/stores/:id/confirm — see Store suggestion/confirmation flow below |
| partner | POST /v1/partner/stores/claim, GET /v1/partner/stores, PATCH /v1/partner/stores/:id, GET /v1/partner/stores/:id/analytics, CRUD /v1/partner/stores/:id/offers, CRUD /v1/partner/stores/:id/events, GET /v1/partner/stores/:id/broadcast/audiences, GET/POST /v1/partner/stores/:id/broadcast (history/send, 3/24h cap), offer-code verify/redeem |
| presence | POST /v1/presence/heartbeat, GET /v1/presence/stores |
| discovery | GET /v1/discovery/nearby, GET /v1/discovery/suggestions |
| encounters | GET /v1/encounters |
| connections | standard CRUD |
| safety | POST /v1/blocks, DELETE /v1/blocks/:userId, GET /v1/blocks, POST /v1/reports |
| admin-moderation | GET /v1/admin/moderation/stats, GET /v1/admin/moderation/reports, GET /v1/admin/moderation/reports/:id, POST /v1/admin/moderation/reports/:id/resolve — ADMIN only |
| admin-users | GET /v1/admin/users (search), GET/PATCH /v1/admin/users/:id, POST /v1/admin/users/:id/moderation-action (WARN/SUSPEND/BAN/UNBAN, no report required) — ADMIN only |
| admin-stores | GET /v1/admin/stores (search), GET/PATCH /v1/admin/stores/:id, POST /v1/admin/stores/:id/reject\|reactivate, DELETE /v1/admin/stores/:id/owners/:userId — plus the submission queue (GET .../submissions, POST .../:id/approve\|reject, POST .../:id/claim-code) and the store-claims queue (GET/POST /v1/admin/store-claims, .../:id/approve\|reject) — ADMIN only |
| gamification | BullMQ queue, processes badge/streak logic after checkin |
| event-reminders | BullMQ queue + processor — schedules/cancels morning-of + T-60min push reminders on RSVP; no HTTP routes |
| lfg | GET/POST/PATCH/DELETE /v1/lfg, GET /v1/lfg/me, POST /v1/lfg/:hostUserId/invite, POST /v1/lfg/:hostUserId/lock — ephemeral, Redis-only instant "who's here now" matching; coexists with (does not replace) `pods` — see below |
| pods | POST /v1/pods, GET /v1/pods, GET /v1/pods/:id, POST /v1/pods/:id/request\|approve\|decline, DELETE /v1/pods/:id, POST /v1/pods/:id/lock — richer request/approve matchmaking with a power-level "fit" score; also Redis-only, no Prisma table — see Pods & Life Tracker below |
| life-tracker | No HTTP routes — Socket.IO gateway at namespace `/life-tracker` for real-time Commander/multiplayer life totals during a locked pod — see Pods & Life Tracker below |
| play-online | POST /v1/play-online/invite — shares a SpellTable/Convoke room link with one or more accepted connections; fire-and-forget push, no server-side room/session state |
| games | POST /v1/games, GET /v1/games/pending, POST /v1/games/:id/confirm, POST /v1/games/:id/dispute, GET /v1/games/me |
| endorsements | POST /v1/games/:gameLogId/endorse — tag a co-player (`GREAT_HOST`/`GOOD_SPORT`/`TAUGHT_THE_FORMAT`/`FAST_PLAYER`/`WELL_BREWED_DECK`/`GENEROUS`) after a `CONFIRMED` shared game; upserted per (fromUser, toUser, gameLog) |
| socials | GET/POST /v1/me/socials, PATCH /v1/me/socials/reorder, PATCH/DELETE /v1/me/socials/:id — one link per platform per user; `FRIENDS`-visibility links only resolve for `ACCEPTED` connections |
| quests | GET /v1/quests — monthly quests with progress; completion (and badge award) is driven by `QuestsService.evaluate()` calls from other services (checkin, game confirm, etc.), **not** by the GET route itself |
| rivalries | GET /v1/rivalries/:opponentId (also GET /v1/me/rivalries — see `me` row above) — fully computed live from confirmed `Encounter`/GameLog rows, no Rivalry table |
| notifications | GET /v1/notifications, GET /v1/notifications/unread-count, POST /v1/notifications/read, POST /v1/notifications/:id/read — the shared in-app feed + push-fanout backend used by event-reminders, badges, quests, broadcasts, and play-invites alike |
| exchange | POST /v1/exchange/token, POST /v1/exchange/resolve — mints a 60s Redis-backed QR/handshake token for one user's profile, resolved by whoever scans it (used by the mobile ScanScreen, unrelated to OAuth) |
| health | GET /health — unconditional `{ status: 'ok' }` liveness ping, no DB/Redis check |

**Role guard**: `apps/api/src/common/guards/roles.guard.ts` + `@Roles()` decorator. Partner routes check ownership in service layer (ADMINs bypass). `AuthGuard` is used on all protected routes — it is **async** and checks `moderationStatus` on every request: BANNED → 403 `account_banned`; actively SUSPENDED → 403 `account_suspended`; expired suspension → lazily resets to ACTIVE. Auth/refresh routes are unguarded and remain reachable.

**Redemption codes**: 8-char alphanumeric from charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no confusable chars).

**CORS**: allows `http://localhost:5173` and `http://localhost:4173` (admin portal).

**Rate limiting**: Redis sliding-window guard (`ThrottleGuard`, registered as global `APP_GUARD`). Keyed by authenticated user ID when a Bearer token is present, else by client IP. `trustProxy: true` on the Fastify adapter ensures the real IP is used behind a proxy.

| Named throttler | Route | Limit | Window |
|---|---|---|---|
| global (default) | all other routes | 100 req | 60 s |
| connections | POST /v1/connections | 10 req | 10 min |
| reports | POST /v1/reports | 5 req | 10 min |
| exchange | POST /v1/exchange/token | 20 req | 5 min |
| auth | POST /v1/auth/apple\|discord\|google\|refresh | 10 req | 10 min |

Constants live in `apps/api/src/throttle/throttle.constants.ts`. Exceeding a limit returns 429 with `Retry-After` (seconds) and `{ statusCode: 429, error: "Too Many Requests", message: "Rate limit exceeded" }`.

**Fail-open vs fail-closed on Redis errors**: `ThrottleOptions.failClosed` (default falsy) controls what happens when the Redis check itself throws. Everything defaults to fail-open (request is allowed) so a Redis blip doesn't take the whole API down. The `auth` throttler on `/v1/auth/apple|discord|google|refresh` and the `exchange` throttler on `POST /v1/exchange/token` set `failClosed: true` — these are the brute-force-sensitive login/token-minting routes, so a Redis outage there returns 503 with `Retry-After` instead of silently removing rate limiting. Set `failClosed: true` on any other route where losing rate-limit protection during a Redis outage would be a bigger risk than a temporary outage.

Env var: `THROTTLE_DISABLED=true` — skips all throttling. Set this in e2e / CI environments to prevent flaky tests.

**DB commands** (run from repo root):
```
pnpm --filter @manamap/api db:migrate   # prisma migrate dev
pnpm --filter @manamap/api db:seed      # seed stores + badges
pnpm --filter @manamap/api db:studio    # Prisma Studio
```

### `apps/mobile` — Expo React Native

- **Framework**: Expo SDK 52, bare workflow, `expo-dev-client`
- **Navigation**: React Navigation (bottom tabs + native stack)
- **State**: TanStack Query v5
- **Auth**: Discord PKCE via `expo-auth-session`, plus native Sign in with Apple/Google; tokens in `expo-secure-store`
- **Maps**: `react-native-maps`
- **BLE**: `react-native-ble-plx`

**Screens**:
| Screen | File |
|---|---|
| Sign in | `src/screens/SignInScreen.tsx` |
| Onboarding (profile setup + decks + vibes) | `src/screens/OnboardingScreen.tsx` |
| Home (quest progress + activity) | `src/screens/HomeScreen.tsx` |
| Discover (radar + nearby players) | `src/screens/DiscoverScreen.tsx` |
| Stores (map + list + detail sheet + checkin) | `src/screens/StoresScreen.tsx` |
| History (encounters grouped by date) | `src/screens/HistoryScreen.tsx` |
| You (profile + RewardsCard + game record + RivalriesCard) | `src/screens/YouScreen.tsx` |
| Connect (connections + confirm game results + endorsement prompt) | `src/screens/ConnectScreen.tsx` |
| Connected reveal (post-connection celebration) | `src/screens/ConnectedRevealScreen.tsx` |
| Player preview (public profile card) | `src/screens/PlayerPreviewScreen.tsx` |
| Pod (active pod view + log game on lock) | `src/screens/PodScreen.tsx` |
| Life Tracker (real-time multiplayer life/counters) | `src/screens/LifeTrackerScreen.tsx` |
| Scan (QR profile exchange via `/v1/exchange`) | `src/screens/ScanScreen.tsx` |
| Notifications feed | `src/screens/NotificationsScreen.tsx` |
| Legal document viewer (terms/privacy) | `src/screens/LegalDocumentScreen.tsx` |

**Key hooks** (all in `src/hooks/`):
- `useAuth` — Discord PKCE / Apple / Google login, secure token storage
- `usePresence` — heartbeat every 30s
- `useNearby`, `useNearestStore` — nearby players/stores from Redis
- `useGamification` — badges, streaks, leaderboard
- `useOffers` — active reward offers for a store
- `useStores` — checkin (`{ newBadges, streak, eligibleOffers }`), event calendar, attend/unattend RSVP
- `useMe` — profile, privacy, decks, onboarding submit, export/delete account, push-token registration
- `useConnections`, `useEncounters`, `useSafety` — connection requests, encounter history, blocks/reports
- `useLfg` — LFG session management (polls every 15s)
- `usePods` — pod feed/detail (polls every 10-15s), request/approve/decline/lock
- `useLifeTracker` — Socket.IO client for `/life-tracker`; optimistic local updates before server echo
- `useGames` — pending games, my games, stats, create/confirm/dispute
- `useEndorsements` — post-game endorsement submission
- `useQuests`, `useRivalries` — monthly quest progress, top-opponent rivalries
- `useSocials` — social link CRUD/reorder
- `useNotifications`, `usePushNotifications` — in-app feed/unread-count/mark-read, and Expo push token registration + deep-link routing by `data.type`
- `usePlayOnline` — send a SpellTable/Convoke room-link invite to connections
- `useContacts` — one-way: saves a ManaMap connection into the device's native contact list (`expo-contacts`); does **not** match device contacts to find friends
- `useBleProximity` — BLE-based nearby-device proximity signal
- `useIdentityTheme` — derives per-user color theme from identity/avatar data

**Dev**:
```
pnpm --filter @manamap/mobile dev   # expo start --dev-client
```
Requires an Android/iOS device or emulator with the Expo dev client installed.

### `apps/admin` — Vite + React Partner Portal

- **URL**: `http://localhost:5173` (dev)
- **Auth**: Discord web OAuth (standard redirect, not PKCE)
- **State**: TanStack Query v5 + React Router v6

**Env file** (create as `apps/admin/.env.local`):
```
VITE_DISCORD_CLIENT_ID=1510362228526809199
VITE_API_URL=http://localhost:3000/api
```

**Routes**:
| Path | Page |
|---|---|
| /login | Discord OAuth link |
| /auth/callback | Exchanges `?code` for tokens |
| /stores | List of owned stores |
| /stores/claim | Search stores + claim |
| /stores/:storeId | Analytics dashboard + offers list |
| /stores/:storeId/offers/new | Create offer |
| /stores/:storeId/offers/:id/edit | Edit offer |
| /stores/:storeId/events | Store-owner event CRUD (weekly recurrence) |
| /stores/:storeId/broadcast | Store-owner push broadcast to an audience segment (live recipient counts, 3/24h send cap) |
| /stores/:storeId/redeem | Store-owner offer-code verify/redeem at point of sale |
| /support, /terms, /privacy | Static support/legal pages (unauthenticated) |
| /moderation | Admin-only moderation queue + detail (redirects non-ADMINs) |
| /admin/users | Admin-only user lookup — search, view detail, edit displayName/role, Warn/Suspend/Ban/Unban directly (no report required) |
| /admin/stores | Admin-only store lookup — search any store, edit basic info, manage owners, deactivate/reactivate |
| /stores/submissions | Admin-only queue for user-suggested (`PROPOSED`) stores — approve/reject; same underlying data as the admin-stores submission queue |
| /stores/claims | Admin-only queue for partner store-ownership claim requests — approve/reject, generate claim codes |

`AuthContext` exposes `role` decoded from the JWT (no extra network call). The sidebar shows an Admin section with the Moderation/Users/All Stores links only when `role === 'ADMIN'`.

**Discord setup**: Add `http://localhost:5173/auth/callback` as an OAuth2 redirect URI in the Discord developer portal.

**Dev**:
```
pnpm --filter @manamap/admin dev
```

---

## Database schema — key models

All IDs are `TEXT` (Prisma `@id @default(uuid())`), stored as plain text UUIDs in Postgres.

| Model | Purpose |
|---|---|
| User | Player account — `role: UserRole (USER/PARTNER/ADMIN)`, `moderationStatus: ModerationStatus (ACTIVE/SUSPENDED/BANNED)`, `suspendedUntil DateTime?`, `deletedAt DateTime?` (anonymized-delete marker, checked by `AuthGuard`) |
| Identity | OAuth identity linked to User — `provider` is `discord`\|`apple`\|`google` |
| Store | Game store with PostGIS geom column; `status (PROPOSED/ACTIVE/REJECTED)` for the crowd-sourced suggestion flow |
| StoreOwnership | Join table — which users own which stores |
| StoreConfirmation | One row per user who has corroborated a `PROPOSED` store (with a PostGIS proximity flag); drives auto-approval |
| Checkin | User check-in at a store with timestamp |
| Streak | Per user/store streak + total check-in count |
| UserBadge | Earned badge, optionally tied to a store |
| Badge | Badge definition with `criteria` JSON |
| RewardOffer | Store reward — type `FIRST_VISIT` or `STREAK`, has `redemptionCode`, `active`, `streakRequired` |
| Event | Store event (source: STORE — manually entered only; no external connectors) |
| Encounter | PvP game result or co-presence encounter; `gameId` FK links to GameLog |
| GameLog | Logged game — `status (PENDING/CONFIRMED/DISPUTED)`, `winnerId`, `format?`, `storeId?`; format stored as plain `String?` (no FK) |
| GamePlayer | Player row per game — `deck?`, `confirmed`; @@unique([gameLogId, userId]); creator auto-confirmed |
| Endorsement | Post-game tag from one player to another — `tag: EndorsementTag`, unique on `(fromUserId, toUserId, gameLogId)`, upserted (re-endorsing changes the tag) |
| SocialLink | One row per (user, platform) — `platform`, `value`, `visibility (PUBLIC/FRIENDS/HIDDEN)`, `sort` |
| Quest | Monthly quest definition — `criteria` JSON (discriminated union), optional `rewardBadgeId` |
| QuestProgress | Per-user progress toward a `Quest` — unique on `(userId, questId)`, `progress`, `completedAt` |
| Notification | In-app notification feed row — `kind`, `title`, `body`, `data` JSON, `readAt`; the shared delivery mechanism for event-reminders, badges, quests, broadcasts, and play-invites |
| PushToken | Expo push token per user, used by `NotificationsService` for best-effort (fire-and-forget, no retry) push sends |
| Broadcast | Store-owner push send — `audience`, `title`, `body`, optional `eventId`, `recipientCount`; rate-limited to 3 per store per rolling 24h |
| Connection | Player friend/connection request |
| RefreshToken | Hashed refresh tokens (rotated on use) |
| Block | Bidirectional block between two users |
| Report | Player report — `reason`, `status (OPEN/REVIEWED/ACTIONED)`, `resolvedById/At/note` — reporter identity never returned by admin endpoints |
| ModerationAction | Immutable audit log entry — `action (DISMISS/WARN/SUSPEND/BAN/UNBAN)`, `targetUserId`, `adminId`, optional `reportId` (null for direct admin actions taken outside the report flow) |

**Not Prisma-backed** (Redis-only, no table): LFG sessions, Pods, and Life Tracker state all live in Redis — see Pods & Life Tracker below. Rivalries are computed live from `Encounter`/`GameLog`, not stored.

**PostGIS**: `stores.geom` is `geography(Point,4326)`. Always use `$queryRaw`/`$executeRaw` for geom queries — Prisma doesn't natively support it.

---

## Migrations

Located at `apps/api/prisma/migrations/`. Applied in timestamp order. Key notes:

- Migration `20260530200949_pnpm_db_seed` uses `DROP INDEX IF EXISTS` (idempotent)
- Migration `20260530240000_gamification` drops the encounters index at the top (ordering fix between shadow DB and real DB)
- Migration `20260530260000_partner_program` adds `UserRole`, `OfferType` enums, `store_ownerships` table, extends `reward_offers`
- Migration `20260531172252_safety_blocks_reports` adds `blocks` and `reports` tables, `ReportReason`/`ReportStatus` enums
- Migration `20260531210000_moderation` adds `ModerationStatus`/`ModerationActionType` enums, `moderationStatus`/`suspendedUntil` to `users`, resolution fields to `reports`, and the `moderation_actions` table
- Migration `20260601120000_games` adds `GameStatus` enum, `game_logs` and `game_players` tables, `game_id` column on `encounters`
- Migration `20260702020000_add_unban_action` adds `UNBAN` to `ModerationActionType` (used by the direct admin-users moderation-action endpoint, not the report-resolution flow)
- If Prisma detects drift and wants to reset — check if shadow DB ordering is the cause before agreeing

---

## Shared package

`packages/shared/src/index.ts` — Zod schemas used by both API and mobile:
- `DiscordAuthBodySchema`, `AppleAuthBodySchema`, `GoogleAuthBodySchema`, `TokenResponseSchema`, `RefreshBodySchema`, `LogoutBodySchema`, `AuthTokensSchema`
- `StorePinSchema`, `StoreDetailSchema`, `CheckinResultSchema` (includes `eligibleOffers`)
- `RewardOfferSchema`, `ActiveOfferSchema`, `CreateRewardOfferSchema`, `UpdateRewardOfferSchema`
- `UserRoleSchema`, `OfferTypeSchema`, `StoreOwnershipSchema`, `ClaimStoreSchema`
- `PartnerAnalyticsSchema`
- `BadgeSchema`, `StreakSchema`, `LeaderboardEntrySchema`
- `NearbyPlayerSchema`, `PresenceHeartbeatSchema`
- `BlockBodySchema`, `ReportBodySchema`, `BlockedUserSchema`, `ReportReasonSchema`
- `ModerationStatusSchema`, `ModerationActionTypeSchema`, `ModerationReportSchema`, `ModerationDetailSchema`, `ModerationSignalSchema`, `ResolveReportSchema`, `ModerationStatsSchema`
- `LfgDurationSchema`, `LfgSessionSchema`, `CreateLfgSchema`, `UpdateLfgSchema`, `LfgFeedItemSchema`, `LfgLockBodySchema`
- `GameStatusSchema`, `GamePlayerSchema`, `GameSchema`, `CreateGameSchema`, `DeckStatSchema`, `GameStatsSchema`, `WinsLeaderboardEntrySchema`
- `WinsLeaderboardEntrySchema` **must be declared before `LeaderboardResponseSchema`** — forward reference; `LeaderboardResponseSchema` has an optional `winsLeaderboard` key
- `AttendEventResponseSchema`, `UnattendEventResponseSchema` — RSVP responses (same shape: `{ eventId, eventName }`)
- `AdminUserActionSchema`, `AdminUpdateUserSchema`, `AdminUserSummarySchema`, `AdminUserDetailSchema` — direct (non-report) admin user lookup/moderation; `AdminUserActionSchema`'s action enum includes `UNBAN` and is intentionally separate from `ModerationActionTypeSchema`/`ResolveReportSchema`, which remain report-flow-only
- `AdminStoreSummarySchema`, `AdminStoreOwnerSchema`, `AdminStoreDetailSchema` — general (non-submission-queue) admin store lookup/management
- `PodToleranceSchema`, `PodFitTierSchema` (`great`/`close`/`off`), `PodFitSchema`, `CreatePodSchema`, `PodFeedItemSchema`, `PodCandidateSchema`, `PodDetailSchema`, `PodMemberActionSchema` — Pods matchmaking (see below)
- `TrackerCounterSchema`, `TrackerPlayerSchema`, `TrackerStateSchema`, `LifeDeltaPayloadSchema`, `CommanderDamagePayloadSchema`, `CounterDeltaPayloadSchema`, `SetTokenPayloadSchema`, `EliminatePayloadSchema` — Life Tracker Socket.IO payloads (see below)
- `OnlinePlatformSchema` (`spelltable`/`convoke`), `PlayOnlineInviteSchema`
- `SocialPlatformSchema`, `SocialVisibilitySchema`, `SocialLinkSchema`, `SocialLinkInputSchema`, `UpdateSocialLinkSchema`, `ReorderSocialLinksSchema`, `SocialsSummarySchema`
- `EndorsementTagSchema`, `EndorseInputSchema`, `EndorsementTagCountSchema`, `EndorsementSummarySchema`
- `QuestCriteriaSchema` (discriminated union: `meet_new_players`, `new_store`, `play_games`, `checkin_streak`, `unique_stores`), `QuestRewardBadgeSchema`, `QuestSchema`, `ActiveQuestSchema`
- `RivalrySchema`
- `NotificationKindSchema` (`CONNECT_REQUEST`/`CONNECT_ACCEPTED`/`NEARBY`/`POD`/`GAME_CONFIRM`/`EVENT_REMINDER`/`BROADCAST`/`QUEST`/`PLAY_INVITE`), `NotificationSchema`, `MarkReadBodySchema`, `NotificationsPageSchema`, `RegisterPushTokenSchema`
- `BroadcastAudienceSchema` (`CHECKED_IN_NOW`/`TODAY`/`EVENT_RSVPS`/`RECENT_30D`), `SendBroadcastSchema`, `BroadcastSchema`, `AudienceCountsSchema`
- `ExchangeTokenSchema`, `ResolveTokenBodySchema` — QR/handshake profile exchange, unrelated to OAuth
- `StoreStatusSchema` (`PROPOSED`/`ACTIVE`/`REJECTED`), `SuggestStoreSchema`, `ConfirmStoreSchema`, `StoreConfirmResultSchema` — crowd-sourced store suggestion/confirmation flow
- `PlayerVibeSchema`, `DeckSiteSchema`, `DeckLinkSchema`, `CreateDeckLinkSchema`, `UpdateDeckLinkSchema`, `OnboardingDeckSchema` (= `CreateDeckLinkSchema`), `OnboardingSubmitSchema`
- `DeleteAccountSchema` and the `AccountExport*Schema` family (checkin/streak/event-attendance/connection/encounter/game/endorsement/redemption/report/block) + `AccountExportSchema` — GDPR export/delete (`GET /v1/me/export`, `DELETE /v1/me`)
- `RedemptionStatusSchema`, `ClaimOfferResponseSchema`, `RedeemCodeSchema`, `RedemptionResultSchema`, `RedemptionListItemSchema`
- `PartnerEventSchema`, `CreateEventSchema`, `UpdateEventSchema`, `FormatItemSchema`

---

## Infrastructure

Assumed running locally:
- **PostgreSQL 16 + PostGIS** on `localhost:5432`
- **Redis** on `localhost:6379`

`docker-compose.yml` at the repo root brings up both (Postgres 16 + PostGIS 3.4, Redis 7) with healthchecks — run `docker compose up -d`.

---

## pnpm workspace notes

- `pnpm-workspace.yaml` has `allowBuilds` for: `@nestjs/core`, `@prisma/client`, `@prisma/engines`, `esbuild`, `msgpackr-extract`, `prisma`
- If `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`, add the package to `allowBuilds` in `pnpm-workspace.yaml`

---

## Code conventions

- All DB IDs are `TEXT` in migrations (not `UUID` type) — Prisma generates UUIDs in application code
- NestJS modules follow: `module.ts` → `service.ts` → `controller.ts`
- API guards: `AuthGuard` (JWT) for all protected routes; `RolesGuard` + `@Roles()` for role checks
- Any NestJS module that uses `AuthGuard` must import `AuthModule` (it exports `AuthGuard` + `JwtModule`)
- TypeScript is strict about unused variables — prefix intentionally unused params with `_`
- After running a migration that changes the Prisma schema, run `pnpm --filter @manamap/api exec prisma generate` to update the client (or just use `db:migrate` which does it automatically)
- No comments unless the WHY is non-obvious
- Mobile hooks live in `apps/mobile/src/hooks/`
- Shared Zod schemas go in `packages/shared/src/index.ts`

---

## Known gotchas

- **React Strict Mode + OAuth callbacks**: `AuthCallbackPage` uses a `sessionStorage` key (scoped to the code value) to prevent React 18 Strict Mode's double-invoke from firing the Discord code exchange twice. Discord codes are single-use — a second request with the same code will fail and bounce the user to `/login`.
- **CORS on Fastify**: `enableCors` must explicitly list `methods` and `allowedHeaders` — defaults are insufficient. See `apps/api/src/main.ts`.
- **Prisma client drift**: if the API fails to compile with "property does not exist on type" for a model field, the Prisma client is stale. Run `db:migrate` or `prisma generate`. On Windows, this requires stopping the API first (the native query engine DLL is locked while the process runs).
- **Moderation enforcement location**: ban/suspend checks live in `AuthGuard` (every authenticated request). Discovery and exchange also exclude non-ACTIVE users at the query level. If you add a new surface that fetches user data, filter on `moderationStatus: ModerationStatus.ACTIVE` to stay consistent.
- **Reporter identity**: the `reporter` / `reporterId` field on `Report` must never be returned by any admin endpoint — only `reported` (the subject) is exposed.
- **LFG sessions are Redis-only**: `lfg:${userId}` (JSON + TTL) and `lfg_store:${storeId}` (zset by expiresAt). No Prisma table. The only durable artifact from an LFG interaction is the `Encounter` rows written at LFG lock-in (source `GAME`, result `DRAW`) — this predates and is separate from the `pods` module's own lock, see Pods & Life Tracker below. Feed filtering mirrors `nearby()` — blocked / non-ACTIVE / non-discoverable / absent-from-store users are excluded.
- **LFG `LfgSession` interface** in `lfg.service.ts` must be `export interface` (not just `interface`) — `declaration: true` in tsconfig requires exported types for public controller return types.
- **`exactOptionalPropertyTypes` + optional props**: when passing a query result (`T | undefined`) to a prop typed `?: T | null`, normalize with `?? null` at the call site rather than widening the prop type. When the prop is `?: T` (no null), use a conditional spread: `{...(val !== undefined ? { prop: val } : {})}`.
- **Game stats vs Encounter rows**: `GET /v1/me/stats` (W/L/winRate/byDeck) is computed directly from `GameLog` + `GamePlayer`, not from `Encounter` rows — avoids double-counting since each confirmed game writes multiple Encounter rows. Do not add encounter-based stats to the stats endpoint.
- **GamesService vs MeService for stats**: `getGameStats` lives in `MeService` (not `GamesService`) to avoid a circular dependency chain. `MeService` queries `gameLog` directly via Prisma.
- **Event reminder job idempotency**: `EventRemindersService.scheduleReminders` uses deterministic BullMQ jobIds (`${eventId}:${userId}:morning|hour`). Re-RSVPing is safe — BullMQ silently ignores adds for existing jobIds. `cancelReminders` calls `job.remove()` which is also safe when the job doesn't exist.
- **Event reminder timezone**: `morningOfAt()` in `event-reminders.service.ts` uses an `Intl` probe to find the UTC time corresponding to 9am in the store's timezone. Falls back to `America/Los_Angeles` when `Store.timezone` is null.
- **Notification opt-out**: `PrivacySettings.eventReminders` (default `true`) gates this — `EventRemindersProcessor.process()` returns early when it's `false`.
- **ADMIN_EMAILS promotion is self-healing, not a one-time migration**: `AuthService.upsertUserByEmail` checks the email against `ADMIN_EMAILS` on every *first-ever* sign-in (all three providers) and sets `role: ADMIN` on create. For a returning user with an already-linked `Identity`, each provider method takes an "existing identity" fast path that skips `upsertUserByEmail` entirely — `promoteIfAdmin` mirrors the same `ADMIN_EMAILS` check on that fast path so already-registered accounts still get promoted the next time they log in, without a backfill script. Since `TokenService.issueTokens` re-reads `role` from the DB on every login/refresh, the new token reflects the promotion immediately. Both paths are promotion-only: removing an email from `ADMIN_EMAILS` does **not** demote an already-promoted account; use the admin-users `PATCH /:id` endpoint (or direct DB update) to demote.
- **Admin can't lock themselves out**: `AdminUsersService.updateProfile` blocks an admin from changing their own `role` away from `ADMIN`, and `takeModerationAction` blocks an admin from moderating (warn/suspend/ban/unban) themselves.
- **`@WebSocketGateway({ port: 3001 })` is dead config**: the life-tracker gateway declares `port: 3001`, but `WsAdapter.createIOServer` (`apps/api/src/ws-adapter.ts`) ignores the port argument and attaches Socket.IO to the same Fastify HTTP server at path `/ws/socket.io`. There is no listener on 3001 — mobile connects to the main `API_PORT` (3000).
- **LFG and Pods are two independent, coexisting Redis-only systems**, not a migration from one to the other: LFG (`lfg:${userId}`) is a single-session instant broadcast; Pods (`pod:${podId}`, 90 min TTL) add a request→approve/decline workflow and a power-level "fit" score. Both write the same kind of all-pairs `Encounter` rows on lock, and neither has a Prisma table.
- **Life-tracker state can outlive its pod**: `life_tracker:${podId}` has an 8hr Redis TTL, but `pod:${podId}` is deleted immediately on lock/disband (90 min TTL otherwise). `join_tracker` falls back to the tracker's own cached `memberIds` when the pod key is already gone, so a tracker session can keep running (and be rejoined) after the pod itself has vanished.
- **Account deletion anonymizes, it does not hard-delete**: `MeService.deleteAccount` scrubs PII on the `User` row (email → `deleted-{id}@manamap.invalid`, name/bio/avatar nulled, role reset) and sets `deletedAt`, but never deletes the row itself — other users' `GameLog`/`Encounter`/accepted `Connection` rows reference it as shared history. `AuthGuard` checks `deletedAt` to block the account immediately even with a still-valid access token. The call is idempotent (`if (user.deletedAt) return`).
- **Quest progress only advances on `QuestsService.evaluate()` calls from other services** (checkin, game confirm, etc.) — `GET /v1/quests` is read-only and does not itself trigger completion or badge award.
- **Exchange tokens are short-lived but not single-use**: `POST /v1/exchange/token` mints a 60s Redis-backed token that isn't deleted after `resolve` — it can be resolved repeatedly by anyone who captures it until the TTL expires.
- **Store suggestion auto-approval**: `POST /v1/stores/suggest` creates a `PROPOSED` store; `POST /v1/stores/:id/confirm` lets others corroborate it (each idempotent per user via a unique constraint). `checkAutoApprove` flips it to `ACTIVE` once confirmations reach ≥3 with at least one proximity-verified, or ≥5 total — independent of the ADMIN-only submission-queue approval path.
- **`dev-login` vs `DEV_TOOLS`**: `POST /v1/auth/dev-login` is gated only by `NODE_ENV !== 'production'` — it is reachable in any non-prod environment even with `DEV_TOOLS` unset, unlike the `/v1/dev/*` bot-simulation routes documented below.

---

## Dev harness (M24)

A DEV-ONLY simulation harness lets one developer populate all screens with believable bot activity.

### Gating
- **API**: DevModule + `/v1/dev/*` routes are only registered when `NODE_ENV !== 'production' && DEV_TOOLS === 'true'`. Without the flag the routes 404.
- **Mobile**: DevScreen is bundled only in `__DEV__` builds and is never reachable in production.

### Enabling
Set `DEV_TOOLS=true` in `apps/api/.env` and restart the API. In the mobile app, long-press the **"You"** tab title (800 ms) to open the Dev panel.

### Bot accounts
Eight stable bot users are seeded by `pnpm --filter @manamap/api db:seed`. All have `isBot=true`, `moderationStatus=ACTIVE`, `discoverable=true`.

| ID | Name | Colors | Formats | Power |
|---|---|---|---|---|
| `bot_wren` | Wren | W/U | commander | 7 |
| `bot_sol` | Sol | R | modern | 8 |
| `bot_kira` | Kira | U/B | pioneer | 6 |
| `bot_dune` | Dune | G/W | standard | 5 |
| `bot_ash` | Ash | B | legacy | 9 |
| `bot_nyx` | Nyx | U | commander/modern | 7 |
| `bot_tarn` | Tarn | R/G | draft | 4 |
| `bot_vex` | Vex | U/R | commander/pioneer | 6 |

### Endpoints (`POST /api/v1/dev/...` — require Bearer token)
| Endpoint | What it does |
|---|---|
| `populate-store` | Bots check in + half go LFG at your store |
| `host-pod` | One bot checks in and creates a pod |
| `request-me` | One bot sends you a connection request |
| `accept-mine` | Bots accept your pending requests to them |
| `log-game-with-me` | Bot logs a game; caller must confirm (caller wins by default) |
| `full-scene` | Runs all of the above in sequence |
| `reset` | Clears all bot Redis keys + pending connections/games involving bots |

### Module structure
- `apps/api/src/dev/` — DevModule, DevService, DevController, dev.bots.ts
- `apps/mobile/src/screens/DevScreen.tsx` — in-app panel (7 buttons)
- `LfgModule`, `PodsModule`, `ConnectionsModule` now export their primary service so DevModule can import them.

---

## Pods & Life Tracker

Pods are a richer, request/approve alternative to LFG for forming a game group at a store, with an optional real-time life-total tracker for the resulting game.

### Pods (`apps/api/src/pods/`)
- Redis-only, like LFG — key `pod:${podId}`, 90 min TTL, no Prisma table
- `CreatePodSchema`: `format?`, `targetPower` (1-10), `tolerance` (1/2/3), `seats` (2-4), `where`, `note?`
- `computeFit` (`pods.service.ts`) scores a candidate's stored power level against the pod's `targetPower`/`tolerance`/format into `great`/`close`/`off` — a compatibility hint, not deck legality
- Creating a pod requires an active check-in (presence key) at the store; one hosted pod per user
- `POST /v1/pods/:id/lock` writes all-pairs `Encounter` rows (`source: GAME`, `result: DRAW`) and deletes the Redis pod — same effect as LFG's lock, does not itself create a `GameLog` or start the life tracker (both are separate manual actions from `PodScreen`)
- `usePodFeed`/`usePodDetail` poll every 10-15s — join-request/approve latency is bounded by polling, not push

### Life Tracker (`apps/api/src/life-tracker/`)
- `LifeTrackerGateway` — Socket.IO gateway, namespace `/life-tracker`, mounted via the custom `WsAdapter` on the main Fastify HTTP server at path `/ws/socket.io` (the gateway's `port: 3001` option is ignored — see Known gotchas)
- Auth: `socket.handshake.auth.token` is verified with the same JWT secret as REST, on `afterInit`, before any subscribe handler runs
- One Socket.IO room per pod (`pod:${podId}`); `join_tracker` requires the caller be in the pod's member list
- State lives in Redis `life_tracker:${podId}` (8hr TTL) via `LifeTrackerService`, with a 20-entry undo history
- `start_tracker` picks starting life 40 for `commander` format, else 20, and is idempotent (rebroadcasts existing state instead of recreating)
- Events: `join_tracker`, `start_tracker`, `life_delta`, `commander_damage`, `counter_delta`, `commander_cast`, `set_token` (monarch/initiative/city's blessing), `eliminate`, `next_turn`, `undo`, `reset_game` — all broadcast the resulting `TrackerState` to the pod's room
- Mobile: `useLifeTracker.ts` applies `life_delta`/`counter_delta` optimistically before the server echo; `LifeTrackerScreen.tsx` renders per-player life/counters/commander-damage

---

## Event reminders (M25)

Push notifications when a user RSVPs to a store event — morning-of (9am store timezone) and T-60min before start. Un-RSVP cancels both jobs.

### API
- `apps/api/src/event-reminders/` — `EventRemindersModule`, `EventRemindersService`, `EventRemindersProcessor`
- Queue name: `'event-reminders'` (separate from `'gamification'`)
- JobId pattern: `${eventId}:${userId}:morning` / `${eventId}:${userId}:hour` — idempotent; re-RSVP is safe
- `StoresService.attendEvent` now fetches `startsAt` + `store.{ id, name, timezone }` and calls `scheduleReminders`
- `StoresService.unattendEvent` — deletes `EventAttendee` row + cancels both jobs
- Route: `DELETE /v1/stores/:id/events/:eventId/attend`

### Mobile
- `useUnattendEvent` hook in `useNearby.ts` — DELETE mutation, invalidates events query
- `EventRow` in `StoresScreen.tsx` — "Going!" toggles both directions; relies on server-side `isAttending` (no optimistic local state)

### Processor guards (run on every job fire)
1. Event `startsAt` already passed → skip
2. `EventAttendee` row no longer exists → skip
3. `Event` row deleted → skip
4. Notification opt-out — `PrivacySettings.eventReminders === false` → skip

### Push payload
```json
{ "type": "event_reminder", "eventId": "...", "storeId": "..." }
```
Title: `"Event starting soon"` (hour) / `"Event reminder"` (morning).

---

## Analytics (PostHog)

Product analytics on PostHog Cloud's free tier — no self-hosting, no session replay. Scoped to
`apps/api` and `apps/mobile` only; `apps/admin` has none. Mobile relies on autocapture (screen
views, app lifecycle) for engagement data; API events are the authoritative "business outcome"
events for funnels/retention since there's no such thing as autocapture server-side.

### API
- `apps/api/src/analytics/` — `AnalyticsModule` (`@Global()`), `AnalyticsService` wrapping `posthog-node`
- No-op when `POSTHOG_API_KEY` is unset (dev/CI safe, mirrors Sentry's conditional init in `main.ts`)
- `AnalyticsService.capture(distinctId, event, properties)` — call sites use `void this.analytics.capture(...)`, fire-and-forget like the existing `this.quests.evaluate(...)` calls
- `onModuleDestroy` calls `client.shutdown()` to flush queued events on process exit
- Env: `POSTHOG_API_KEY`, `POSTHOG_HOST` (default `https://us.i.posthog.com`)

### Mobile
- `PostHogProvider` wraps the tree in `App.tsx`, between `SafeAreaProvider` and `QueryClientProvider` — must be an ancestor of `AuthProvider` so `usePostHog()` works there
- The provider is given an explicit `client` (constructed in a `useMemo`, not via its `apiKey` prop) so `client.optOut()` can be called synchronously at construction time when `EXPO_PUBLIC_POSTHOG_API_KEY` is blank — the true no-op path
- `captureScreens` autocapture is disabled on the provider (`autocapture={{ captureScreens: false }}`) because the provider sits above `NavigationContainer` in the tree, where its internal screen tracker can't see navigation state. Screen views are tracked instead by a small `PostHogScreenTracker` component (calls `useNavigationTracker()`) rendered *inside* `NavigationContainer`
- `AuthContext.signIn` decodes the JWT `sub` claim client-side (no signature verification — only used as a PostHog distinct ID) and calls `posthog.identify(sub)`; the initial session-restore effect does the same for already-logged-in users on cold start; `signOut` calls `posthog.reset()` (covers manual sign-out and forced 401 logout, both routed through `signOut`)
- Env: `EXPO_PUBLIC_POSTHOG_API_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`

### Events (`@manamap/shared` → `AnalyticsEvent`)
| Event | Fired from |
|---|---|
| `store_checkin` | `StoresService.checkin` |
| `event_rsvp_created` | `StoresService.attendEvent` |
| `event_rsvp_cancelled` | `StoresService.unattendEvent` |
| `badge_earned` | `GamificationService.evaluateAndAwardBadges` (once per badge actually persisted) |
| `game_confirmed` | `GamesService.confirm` (once per player, `won` property distinguishes winner/loser) |

`distinctId` is the `User.id` / JWT `sub` on both platforms, so mobile and API events join into the same funnels.
