# ManaMap

A social + location app for Magic: The Gathering players. Check in to local game stores, track streaks and badges, discover nearby players, form pods, log games, and get reminders for upcoming events.

## Monorepo structure

```
apps/
  api/      — NestJS + Fastify REST API (TypeScript, port 3000)
  mobile/   — Expo React Native app (TypeScript)
  admin/    — Vite + React partner portal for store owners (TypeScript, port 5173)
packages/
  shared/   — Zod schemas shared between API and mobile
```

Package manager: **pnpm workspaces**. Run all commands from the repo root.

## Prerequisites

- Node 20+
- pnpm 9+
- PostgreSQL 15 with PostGIS (`localhost:5432`, db `manamap`)
- Redis (`localhost:6379`)

## Setup

```bash
pnpm install

# Copy and fill in env files
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local

# Run migrations, generate Prisma client, seed stores + badges + bot accounts
pnpm --filter @manamap/api db:migrate
pnpm --filter @manamap/api db:seed
```

## Running locally

```bash
# API (terminal 1)
pnpm --filter @manamap/api dev          # http://localhost:3000

# Mobile (terminal 2) — requires Expo dev client on device/emulator
pnpm --filter @manamap/mobile dev

# Admin portal (terminal 3)
pnpm --filter @manamap/admin dev        # http://localhost:5173
```

## API

All routes are prefixed `/api/v1/`. Auth via Discord OAuth → JWT access + refresh tokens.

| Module | Key routes |
|---|---|
| auth | POST /v1/auth/discord, POST /v1/auth/refresh |
| me | GET/PATCH /v1/me, /v1/me/privacy, /v1/me/decks, /v1/me/streaks, /v1/me/stats |
| stores | GET /v1/stores, /v1/stores/:id, POST checkin, GET events + leaderboard + offers, POST/DELETE attend |
| discovery | GET /v1/discovery/nearby, /v1/discovery/suggestions |
| presence | POST /v1/presence/heartbeat, GET /v1/presence/stores |
| lfg | CRUD /v1/lfg — "open to play now" sessions (Redis-only, ephemeral) |
| pods | Invite-based play pods (Redis-only, ephemeral) |
| games | POST /v1/games — log results; confirm/dispute |
| connections | Player friend requests |
| safety | Blocks + reports |
| partner | Store claim + offer management (PARTNER role) |
| admin-moderation | Report queue + actions (ADMIN role) |
| gamification | BullMQ worker — badges and streaks after check-in |
| event-reminders | BullMQ worker — morning-of + T-60min RSVP push reminders |

## Database

PostgreSQL 15 + PostGIS. ORM: Prisma.

```bash
pnpm --filter @manamap/api db:migrate   # prisma migrate dev
pnpm --filter @manamap/api db:seed      # seed formats, stores, badges, bot accounts
pnpm --filter @manamap/api db:studio    # Prisma Studio on :5555
```

Store data is in `apps/api/prisma/data/stores.json` — 25 real MTG LGS across Seattle and Portland. Stores are upserted on `(name, city)` so re-seeding is safe.

## Mobile

Expo SDK 52 bare workflow. Screens: Discover, Stores, History, You, Connect, Pod.

Features: Discord PKCE login · BLE proximity · check-in with PostGIS gating · event RSVP + push reminders · LFG/pods · game logging.

## Admin portal

Partner-facing: claim stores, manage reward offers (FIRST_VISIT / STREAK), view check-in analytics. Admins see a moderation queue for reports.

Discord redirect URI to add: `http://localhost:5173/auth/callback`

## Dev harness

Populate all screens with believable bot activity during development.

1. Set `DEV_TOOLS=true` in `apps/api/.env` and restart the API.
2. Long-press the **"You"** tab title (800 ms) in the mobile app to open the Dev panel.

Eight bot accounts are seeded by `db:seed`: `bot_wren`, `bot_sol`, `bot_kira`, `bot_dune`, `bot_ash`, `bot_nyx`, `bot_tarn`, `bot_vex`.

API endpoints: `POST /api/v1/dev/populate-store|host-pod|request-me|accept-mine|log-game-with-me|full-scene|reset`

## Environment variables

### `apps/api/.env`

```
DATABASE_URL=postgresql://manamap:manamap@localhost:5432/manamap
REDIS_URL=redis://localhost:6379
API_PORT=3000
API_HOST=localhost
JWT_SECRET=<secret>
DISCORD_CLIENT_ID=<id>
DISCORD_CLIENT_SECRET=<secret>
DISCORD_REDIRECT_URI=manamap://auth/discord
DEV_TOOLS=true          # optional — enables /v1/dev/* routes
THROTTLE_DISABLED=true  # optional — disables rate limiting (CI/e2e)
```

### `apps/admin/.env.local`

```
VITE_DISCORD_CLIENT_ID=<id>
VITE_API_URL=http://localhost:3000/api
```

## Tech stack

| Layer | Technology |
|---|---|
| API | NestJS + Fastify |
| Database | PostgreSQL 15 + PostGIS |
| ORM | Prisma |
| Cache / presence / LFG | Redis |
| Queue | BullMQ (gamification + event-reminders) |
| Push notifications | Expo Push (expo-server-sdk) |
| Mobile | Expo React Native SDK 52 |
| Mobile state | TanStack Query v5 |
| Admin portal | Vite + React + React Router v6 |
| Auth | Discord OAuth2 + JWT |
| Schema validation | Zod (shared between API and mobile) |
| Monorepo | pnpm workspaces |
