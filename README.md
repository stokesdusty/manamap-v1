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

### Android builds on Windows

Windows has a 260-character path limit. pnpm's content-addressable store adds long, hash-suffixed directory names to every native package path (e.g. `node_modules/.pnpm/react-native-screens@4.25.2_<hash>/node_modules/react-native-screens/android/...`), and combined with deeply-nested Gradle/Kotlin/CMake build output, this reliably tips some files over the limit — even with Windows' `LongPathsEnabled=1` registry setting on, since ninja (bundled with the Android SDK's CMake) doesn't handle long paths reliably. Symptom: `ninja: error: manifest 'build.ninja' still dirty after 100 tries`, or `ninja: Filename longer than 260 characters`.

**The fix is local-machine-only — do not put it in any committed file.** Add this to your **user-level** npmrc (`C:\Users\<you>\.npmrc` — NOT the project's `.npmrc` or `pnpm-workspace.yaml`) to relocate pnpm's virtual store to a short path:

```
virtual-store-dir=C:/pm
```

Then do one clean reinstall so it actually takes effect (pnpm won't relocate an existing store on a plain `pnpm install` — it has to be forced once):

```bash
cd c:\m
rm -rf node_modules
pnpm install --virtual-store-dir=C:/pm
```

After that, plain `pnpm install` runs keep using the relocated store. If you ever see the ninja error again, also clear these stale caches and retry:

```bash
rm -rf "$HOME/.gradle/caches/build-cache-1"
find . -type d -name ".cxx" -exec rm -rf {} +
```

**Never add `virtual-store-dir`/`virtualStoreDir` to the project's `pnpm-workspace.yaml` or root `.npmrc`.** Those files are committed and also read by EAS Build's cloud machines (which run Linux) — a Windows absolute path there breaks the Android Gradle build in the cloud. See "Cloud builds (EAS) on Windows" below.

Keeping the repo at a short root path (`C:\m`) still helps on top of this, but isn't sufficient on its own — the pnpm store relocation is the actual fix.

```bash
# Local Android build + install on a connected device/emulator (run from repo root)
cd apps/mobile
npx expo run:android
```

### Cloud builds (EAS) on Windows

`eas build` uploads your local working directory, then runs a genuinely fresh `pnpm install --frozen-lockfile` on a Linux build machine — your local `node_modules`/pnpm store layout doesn't affect that install. **However**, stale generated files left over from local Windows builds still get swept into the upload and are not reliably excluded by `.easignore` for this project, specifically:

- `apps/mobile/android/build/generated/autolinking/autolinking.json`
- other content under `android/build/`, `android/app/build/`, `**/.cxx/`

These bake in absolute Windows paths (`C:/pm/...`) from your last local build. When uploaded and read during the Linux Gradle build, they fail with:

```
Configuring project ':react-native-screens' without an existing directory is not allowed. The configured projectDirectory
'/home/expo/workingdir/build/apps/mobile/android/C:/pm/react-native-screens@.../android' does not exist...
```

**Before every `eas build --platform android`, clean these locally first:**

```bash
cd apps/mobile
rm -rf android/build android/app/build
find android -type d -name ".cxx" -exec rm -rf {} +
```

And don't run a local `npx expo run:android` between cleaning and triggering the EAS build — it immediately regenerates the stale file. Note `eas build --clear-cache` does **not** fix this; it clears EAS's own build cache, not the contents of your uploaded project archive.

### iOS / Android build numbers (TestFlight, Play Store)

`eas.json`'s `cli.appVersionSource` is set to `"remote"` — EAS tracks `ios.buildNumber` / `android.versionCode` itself and auto-increments on every build. You don't need to bump anything in `app.config.ts` by hand for this anymore.

If you ever need to explicitly jump the counter (e.g. after a manual reset on Apple's/Google's side), run interactively in a real terminal (this prompt can't be satisfied via piped/non-interactive input):

```bash
cd apps/mobile
eas build:version:set -p ios -e production
eas build:version:set -p android -e production
```

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

## Hidden / future features

The following features are fully implemented in the API and data model but are hidden from the mobile UI. They can be re-enabled by restoring the relevant render calls in the mobile app.

| Feature | Status | Where to re-enable |
|---|---|---|
| Monthly quests | Hidden | Restore `<QuestsCard>` in `YouScreen` |

Game logging (`<ConfirmResultsSection>` in `ConnectScreen`, `<GameRecordCard>`/`<RecentGamesCard>`/`<RivalriesCard>` in `YouScreen`) and the post-game endorsement prompt (`<EndorsementPromptSheet>`, fired after a confirmed game) are live. Creating a game is reachable from the Home screen's "Log a Game" tile and from locking in a pod; endorsement chips show on profile and connection detail once endorsements exist.

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
