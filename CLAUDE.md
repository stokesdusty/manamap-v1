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
- **Queue**: BullMQ (gamification badges/streaks after checkin)
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
| stores | GET /v1/stores, GET /v1/stores/:id, POST /v1/stores/:id/checkin, GET /v1/stores/:id/offers, GET /v1/stores/:id/events, GET /v1/stores/:id/leaderboard |
| partner | POST /v1/partner/stores/claim, GET /v1/partner/stores, PATCH /v1/partner/stores/:id, GET /v1/partner/stores/:id/analytics, CRUD /v1/partner/stores/:id/offers |
| presence | POST /v1/presence/heartbeat, GET /v1/presence/stores |
| discovery | GET /v1/discovery/nearby |
| encounters | GET /v1/encounters |
| connections | standard CRUD |
| gamification | BullMQ queue, processes badge/streak logic after checkin |

**Role guard**: `apps/api/src/common/guards/roles.guard.ts` + `@Roles()` decorator. Partner routes check ownership in service layer (ADMINs bypass). Regular `AuthGuard` is used on all protected routes.

**Redemption codes**: 8-char alphanumeric from charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no confusable chars).

**CORS**: allows `http://localhost:5173` and `http://localhost:4173` (admin portal).

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
| You (profile + RewardsCard) | `src/screens/YouScreen.tsx` |

**Key hooks** (all in `src/hooks/`):
- `useAuth` — Discord PKCE login, secure token storage
- `usePresence` — heartbeat every 30s
- `useNearby` — nearby players from Redis
- `useBadges`, `useStreaksSummary`, `useLeaderboard` — gamification
- `useStoreOffers` — active reward offers for a store
- `useCheckin` — POST checkin, returns `{ newBadges, streak, eligibleOffers }`

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
| User | Player account, has `role: UserRole (USER/PARTNER/ADMIN)` |
| Identity | Discord OAuth identity linked to User |
| Store | Game store with PostGIS geom column |
| StoreOwnership | Join table — which users own which stores |
| Checkin | User check-in at a store with timestamp |
| Streak | Per user/store streak + total check-in count |
| UserBadge | Earned badge, optionally tied to a store |
| Badge | Badge definition with `criteria` JSON |
| RewardOffer | Store reward — type `FIRST_VISIT` or `STREAK`, has `redemptionCode`, `active`, `streakRequired` |
| Event | Store event (source: STORE/DISCORD/WIZARDS) |
| Encounter | PvP game result or co-presence encounter |
| Connection | Player friend/connection request |
| RefreshToken | Hashed refresh tokens (rotated on use) |

**PostGIS**: `stores.geom` is `geography(Point,4326)`. Always use `$queryRaw`/`$executeRaw` for geom queries — Prisma doesn't natively support it.

---

## Migrations

Located at `apps/api/prisma/migrations/`. Applied in timestamp order. Key notes:

- Migration `20260530200949_pnpm_db_seed` uses `DROP INDEX IF EXISTS` (idempotent)
- Migration `20260530240000_gamification` drops the encounters index at the top (ordering fix between shadow DB and real DB)
- Migration `20260530260000_partner_program` adds `UserRole`, `OfferType` enums, `store_ownerships` table, extends `reward_offers`
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
- No comments unless the WHY is non-obvious
- Mobile hooks live in `apps/mobile/src/hooks/`
- Shared Zod schemas go in `packages/shared/src/index.ts`
