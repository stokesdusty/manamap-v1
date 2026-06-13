# ManaMap — Claude Context

## What is this?

ManaMap is a social/location app for Magic: The Gathering players. Players check in to local game stores, track streaks and badges, discover nearby players, and view store events. Store owners use a web portal to manage reward offers. It is a pnpm monorepo.

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
- **Database**: PostgreSQL 15 + PostGIS at `localhost:5432`, db `manamap`
- **Cache**: Redis at `localhost:6379` (presence/nearby)
- **ORM**: Prisma — schema at `apps/api/prisma/schema.prisma`
- **Queue**: BullMQ — two queues: `gamification` (badges/streaks after checkin), `event-reminders` (RSVP push reminders)
- **Auth**: Discord OAuth → JWT access + refresh tokens
  - Mobile uses PKCE with custom scheme `manamap://auth/discord`
  - Web (admin portal) uses standard redirect URI with `redirectUri` passed in body
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
```

**Modules** (all in `apps/api/src/`):
| Module | Routes |
|---|---|
| auth | POST /v1/auth/discord, POST /v1/auth/refresh |
| me | GET/PATCH /v1/me, GET/PATCH /v1/me/privacy, GET /v1/me/decks, GET /v1/me/streaks |
| stores | GET /v1/stores, GET /v1/stores/:id, POST /v1/stores/:id/checkin, GET /v1/stores/:id/offers, GET /v1/stores/:id/events, GET /v1/stores/:id/leaderboard, POST /v1/stores/:id/events/:eventId/attend, DELETE /v1/stores/:id/events/:eventId/attend |
| partner | POST /v1/partner/stores/claim, GET /v1/partner/stores, PATCH /v1/partner/stores/:id, GET /v1/partner/stores/:id/analytics, CRUD /v1/partner/stores/:id/offers |
| presence | POST /v1/presence/heartbeat, GET /v1/presence/stores |
| discovery | GET /v1/discovery/nearby, GET /v1/discovery/suggestions |
| encounters | GET /v1/encounters |
| connections | standard CRUD |
| safety | POST /v1/blocks, DELETE /v1/blocks/:userId, GET /v1/blocks, POST /v1/reports |
| admin-moderation | GET /v1/admin/moderation/stats, GET /v1/admin/moderation/reports, GET /v1/admin/moderation/reports/:id, POST /v1/admin/moderation/reports/:id/resolve — ADMIN only |
| gamification | BullMQ queue, processes badge/streak logic after checkin |
| event-reminders | BullMQ queue + processor — schedules/cancels morning-of + T-60min push reminders on RSVP; no HTTP routes |
| lfg | GET/POST/PATCH/DELETE /v1/lfg, GET /v1/lfg/me, POST /v1/lfg/:hostUserId/invite, POST /v1/lfg/:hostUserId/lock |
| games | POST /v1/games, GET /v1/games/pending, POST /v1/games/:id/confirm, POST /v1/games/:id/dispute, GET /v1/games/me |
| me (stats) | GET /v1/me/stats — game W/L/winRate/byDeck, computed from GameLog |

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

Constants live in `apps/api/src/throttle/throttle.constants.ts`. Exceeding a limit returns 429 with `Retry-After` (seconds) and `{ statusCode: 429, error: "Too Many Requests", message: "Rate limit exceeded" }`.

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
- **Auth**: Discord PKCE via `expo-auth-session`, tokens in `expo-secure-store`
- **Maps**: `react-native-maps`
- **BLE**: `react-native-ble-plx`

**Screens**:
| Screen | File |
|---|---|
| Discover (radar + nearby players) | `src/screens/DiscoverScreen.tsx` |
| Stores (map + list + detail sheet + checkin) | `src/screens/StoresScreen.tsx` |
| History (encounters grouped by date) | `src/screens/HistoryScreen.tsx` |
| You (profile + RewardsCard + game record) | `src/screens/YouScreen.tsx` |
| Connect (connections + confirm game results) | `src/screens/ConnectScreen.tsx` |
| Pod (active pod view + log game on lock) | `src/screens/PodScreen.tsx` |

**Key hooks** (all in `src/hooks/`):
- `useAuth` — Discord PKCE login, secure token storage
- `usePresence` — heartbeat every 30s
- `useNearby` — nearby players from Redis
- `useBadges`, `useStreaksSummary`, `useLeaderboard` — gamification
- `useStoreOffers` — active reward offers for a store
- `useCheckin` — POST checkin, returns `{ newBadges, streak, eligibleOffers }`
- `useStoreEvents` — event calendar for a store; `useAttendEvent` / `useUnattendEvent` — RSVP toggle (invalidates events query on success)
- `useLfgMe`, `useLfgFeed`, `useCreateLfg`, `useUpdateLfg`, `useDeleteLfg`, `useLfgInvite`, `useLfgLock` — LFG session management (polls every 15s)
- `usePendingGames`, `useMyGames`, `useMyGameStats`, `useCreateGame`, `useConfirmGame`, `useDisputeGame` — game logging and stats

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
| /moderation | Admin-only moderation queue + detail (redirects non-ADMINs) |

`AuthContext` exposes `role` decoded from the JWT (no extra network call). The sidebar shows an Admin section with the Moderation link only when `role === 'ADMIN'`.

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
| User | Player account — `role: UserRole (USER/PARTNER/ADMIN)`, `moderationStatus: ModerationStatus (ACTIVE/SUSPENDED/BANNED)`, `suspendedUntil DateTime?` |
| Identity | Discord OAuth identity linked to User |
| Store | Game store with PostGIS geom column |
| StoreOwnership | Join table — which users own which stores |
| Checkin | User check-in at a store with timestamp |
| Streak | Per user/store streak + total check-in count |
| UserBadge | Earned badge, optionally tied to a store |
| Badge | Badge definition with `criteria` JSON |
| RewardOffer | Store reward — type `FIRST_VISIT` or `STREAK`, has `redemptionCode`, `active`, `streakRequired` |
| Event | Store event (source: STORE/DISCORD/WIZARDS) |
| Encounter | PvP game result or co-presence encounter; `gameId` FK links to GameLog |
| GameLog | Logged game — `status (PENDING/CONFIRMED/DISPUTED)`, `winnerId`, `format?`, `storeId?`; format stored as plain `String?` (no FK) |
| GamePlayer | Player row per game — `deck?`, `confirmed`; @@unique([gameLogId, userId]); creator auto-confirmed |
| Connection | Player friend/connection request |
| RefreshToken | Hashed refresh tokens (rotated on use) |
| Block | Bidirectional block between two users |
| Report | Player report — `reason`, `status (OPEN/REVIEWED/ACTIONED)`, `resolvedById/At/note` — reporter identity never returned by admin endpoints |
| ModerationAction | Immutable audit log entry — `action (DISMISS/WARN/SUSPEND/BAN)`, `targetUserId`, `adminId`, optional `reportId` |

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
- If Prisma detects drift and wants to reset — check if shadow DB ordering is the cause before agreeing

---

## Shared package

`packages/shared/src/index.ts` — Zod schemas used by both API and mobile:
- `DiscordAuthBodySchema`, `TokenResponseSchema`
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

---

## Infrastructure

Assumed running locally:
- **PostgreSQL 15 + PostGIS** on `localhost:5432`
- **Redis** on `localhost:6379`

No Docker config is in the repo — run them directly or via Docker outside the repo.

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
- **LFG sessions are Redis-only**: `lfg:${userId}` (JSON + TTL) and `lfg_store:${storeId}` (zset by expiresAt). No Prisma table. The only durable artifact from an LFG interaction is the `Encounter` rows written at pod lock-in (source `GAME`, result `DRAW`). Feed filtering mirrors `nearby()` — blocked / non-ACTIVE / non-discoverable / absent-from-store users are excluded.
- **LFG `LfgSession` interface** in `lfg.service.ts` must be `export interface` (not just `interface`) — `declaration: true` in tsconfig requires exported types for public controller return types.
- **`exactOptionalPropertyTypes` + optional props**: when passing a query result (`T | undefined`) to a prop typed `?: T | null`, normalize with `?? null` at the call site rather than widening the prop type. When the prop is `?: T` (no null), use a conditional spread: `{...(val !== undefined ? { prop: val } : {})}`.
- **Game stats vs Encounter rows**: `GET /v1/me/stats` (W/L/winRate/byDeck) is computed directly from `GameLog` + `GamePlayer`, not from `Encounter` rows — avoids double-counting since each confirmed game writes multiple Encounter rows. Do not add encounter-based stats to the stats endpoint.
- **GamesService vs MeService for stats**: `getGameStats` lives in `MeService` (not `GamesService`) to avoid a circular dependency chain. `MeService` queries `gameLog` directly via Prisma.
- **Event reminder job idempotency**: `EventRemindersService.scheduleReminders` uses deterministic BullMQ jobIds (`${eventId}:${userId}:morning|hour`). Re-RSVPing is safe — BullMQ silently ignores adds for existing jobIds. `cancelReminders` calls `job.remove()` which is also safe when the job doesn't exist.
- **Event reminder timezone**: `morningOfAt()` in `event-reminders.service.ts` uses an `Intl` probe to find the UTC time corresponding to 9am in the store's timezone. Falls back to `America/Los_Angeles` when `Store.timezone` is null.
- **Notification opt-out**: no preference field exists yet — reminders always send. When a field is added to `PrivacySettings`, gate it in `EventRemindersProcessor.process()` before the `sendPush` call.

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
4. Notification opt-out (TODO — no field yet)

### Push payload
```json
{ "type": "event_reminder", "eventId": "...", "storeId": "..." }
```
Title: `"Event starting soon"` (hour) / `"Event reminder"` (morning).
