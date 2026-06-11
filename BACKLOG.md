# manamap — Backlog

Living backlog of candidate features beyond the shipped roadmap (Phase 0–3) and
hardening set (M14–M18, all merged). Ordered roughly by leverage. Keep this file
in the repo root so it travels with the code and the coding agent can read it as
context. Move items into a milestone prompt when you pick them up; strike them
through or delete when shipped.

> Status as of this writing: Phases 1–3 + M14 (safety) · M15 (seeding) ·
> M16 (onboarding) · M17 (dark theme) · M18 (proximity check-in) · M19 (moderation dashboard + enforcement) · M20 (LFG) · M21 (rate limiting) · M22 (pods) · M23 (log a game + player stats) are **shipped**.



## 🛡️ Trust & Safety
- [x] **Moderation dashboard** — ADMIN-gated two-pane queue in admin portal; warn/suspend/ban enforcement in AuthGuard; discovery + exchange exclude non-ACTIVE users. *(shipped M19)*
- [x] **Rate limiting** — sliding-window caps on connection requests, reports, and exchange-token mints; global backstop on all routes; per-user keying when authed, per-IP otherwise; Redis-backed for multi-instance consistency. *(shipped M21)*

## 🎲 The "play a game" loop  *(highest product upside)*
- [x] **LFG / "Open to play now"** — a live, expiring status at your current store
  so players know you want a pod right now. Builds on the presence layer.
- [x] **Pod formation** — assemble a 4-player Commander pod from who's open at the
  store; suggest by power level + format.
- [x] **Log a game** — record the pod roster + result after playing. Feeds
  matchmaking, "played before" history, and stats. (`Encounter` model already
  anticipates PvP results.) *(shipped M23)*
- [x] **Player stats** — games played + win/loss per commander/deck; surfaced on
  the profile card. *(shipped M23)*

## 📅 Events
- [x] **RSVP reminders** — push the morning of / hour before an event you're
  attending.
- [x] **Event-day check-in tie-in** — link a check-in to an active event; "who's
  here for Friday Commander."

## 🏪 Store-owner value (admin portal)
- [x] **Broadcast announcement** — let a store push a message to players currently
  checked in (or recent visitors).
- [x] **Event management** — create/edit store events in the portal (today events
  are read-only / connector-sourced).
- [x] **Staff redemption-verify** — a counter flow to validate/redeem the 8-char
  offer codes (enter or scan), marking them used.

## 🔁 Retention
- [x] **Notifications center / inbox** — in-app history of connects, accepts,
  nearby pings, event reminders (push tokens already exist).
- [x] **Monthly quests** — "meet 3 new players", "try a new store" — data-driven
  like badges.
- [x] **Friend-streaks** — reward repeatedly playing the same people, not just
  visiting the same store.

## ⚙️ Platform & quality
- [ ] **docker-compose** in-repo for Postgres+PostGIS+Redis (CLAUDE.md notes none
  exists).
- [ ] **Push delivery** for the social loop (request / accept / nearby) via the
  existing Expo push tokens.
- [ ] **E2E tests** for the core flows (auth → onboarding → check-in → connect).
- [ ] **Observability** — structured logging + error tracking on the API.


---

## 🚀 Production & Beta Launch

Pre-requisites before touching infra: complete all **Pre-flight** items first, then work the phases in order. Each section has a checkbox per discrete action.

---

### Pre-flight: Code changes (must land before any deploy)

#### PF-1 — Fix Socket.IO to share port 3000
The life tracker's `WsAdapter` currently spawns its own `http.createServer()` on port 3001. Cloud platforms expose one port per service, so this will silently fail in production. Fix it to attach Socket.IO to the existing Fastify HTTP server.

- [x] **`apps/api/src/ws-adapter.ts`** — remove the `wsPort: number` constructor param and the `http.createServer()` block entirely. Change `createIOServer` to use `this.httpServer` (the raw Node.js HTTP server NestJS's `IoAdapter` base class exposes via `super(app)`) instead of creating a new one. Set `path: '/ws/socket.io'` on the Server options. Replace the hardcoded `cors: { origin: '*' }` with `cors: { origin: process.env['CORS_ORIGIN']?.split(',') ?? [] }`. Final class should look like:
  ```ts
  import { IoAdapter } from '@nestjs/platform-socket.io';
  import type { INestApplication } from '@nestjs/common';
  import { Server, type ServerOptions } from 'socket.io';

  export class WsAdapter extends IoAdapter {
    private ioServer: Server | null = null;

    constructor(app: INestApplication) { super(app); }

    createIOServer(_port: number, options?: ServerOptions): Server {
      if (!this.ioServer) {
        this.ioServer = new Server(this.httpServer, {
          path: '/ws/socket.io',
          cors: { origin: process.env['CORS_ORIGIN']?.split(',') ?? [] },
          ...options,
        });
      }
      return this.ioServer;
    }
  }
  ```
- [x] **`apps/api/src/main.ts`** — change `new WsAdapter(app, env.WS_PORT)` to `new WsAdapter(app)`.
- [x] **`apps/api/src/config/config.schema.ts`** — remove the `WS_PORT` field (or make it `z.coerce.number().optional()` if you want to leave the env var harmless).
- [x] **`apps/mobile/src/hooks/useLifeTracker.ts`** — line 14: change `EXPO_PUBLIC_WS_URL` to `EXPO_PUBLIC_API_URL` (same host, no separate port). Line 31: add `path: '/ws/socket.io'` to the `io()` options object. Result:
  ```ts
  const WS_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';
  // ...
  socket = io(`${WS_URL}/life-tracker`, {
    path: '/ws/socket.io',
    auth: { token: tokens.accessToken },
    transports: ['websocket'],
    // ...
  });
  ```
- [x] **Remove `EXPO_PUBLIC_WS_URL`** from any `.env` files or EAS secrets — it's no longer needed.
- [x] **Smoke test locally**: start API (`pnpm --filter @manamap/api dev`), open the life tracker in the simulator, confirm the Socket.IO connection connects on port 3000 via the `/ws/socket.io` path.

#### PF-2 — Parameterize CORS origin
- [x] **`apps/api/src/main.ts`** — replace the hardcoded `origin` array with:
  ```ts
  origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim()),
  ```
  This falls back to localhost in dev but reads the env var in production.

#### PF-3 — Add a production migration script
- [x] **`apps/api/package.json`** — add under `"scripts"`:
  ```json
  "db:migrate:prod": "prisma migrate deploy"
  ```
  (`migrate deploy` applies pending migrations without creating new ones and is safe in CI/production. Never run `migrate dev` against a production database.)

#### PF-4 — Create `eas.json`
- [x] Create **`apps/mobile/eas.json`** (EAS looks for this next to `app.config.ts`):
  ```json
  {
    "cli": { "version": ">= 12.0.0" },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      },
      "preview": {
        "distribution": "internal",
        "env": {
          "EXPO_PUBLIC_API_URL": "https://FILL_IN_AFTER_PHASE_1.up.railway.app"
        }
      },
      "production": {
        "env": {
          "EXPO_PUBLIC_API_URL": "https://FILL_IN_AFTER_PHASE_1.up.railway.app"
        }
      }
    },
    "submit": {
      "production": {}
    }
  }
  ```
  Fill in the Railway URL after Phase 1 completes.

#### PF-5 — Enable OTA updates in app.config.ts
OTA lets you push JS-only hotfixes during beta without submitting a new build to Apple/Google.
- [x] **`apps/mobile/app.config.ts`** — add two top-level fields inside the config object (same level as `name`, `slug`):
  ```ts
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/3497a3d5-7a81-4da9-89a3-5108ce4a69ee' },
  ```
  The project ID (`3497a3d5-...`) already exists in `extra.eas.projectId`, so this is consistent.

---

### Phase 1: Cloud Infrastructure

#### 1A — Railway: Postgres + PostGIS + Redis + API service

Railway hosts all three backend pieces (Postgres, Redis, Node.js API) in one dashboard with a shared private network.

1. [ ] Sign up at **railway.app** → "New Project".
2. [ ] **Provision Postgres**: click "+ New" → "Database" → "PostgreSQL". Wait for it to spin up (< 1 min). Click it → "Connect" tab → copy the `DATABASE_URL` (connection string starting with `postgresql://`).
3. [ ] **Enable PostGIS** — this must happen before running Prisma migrations or they will fail on the `geography` column. Click the Postgres service → "Connect" tab → "Query" (or "Database Shell"). Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS postgis_topology;
   ```
   Confirm with `SELECT PostGIS_version();` — should return a version string.
4. [ ] **Provision Redis**: click "+ New" → "Database" → "Redis". Copy the `REDIS_URL` from its "Connect" tab. (Note: Railway Redis is a standard Redis process. Do NOT substitute Upstash — it breaks BullMQ's blocking commands used by event reminders and gamification queues.)
5. [ ] **Add API service**: click "+ New" → "GitHub Repo" → select `manamap` → pick the `main` branch.
6. [ ] In the API service settings → **Build & Deploy**:
   - **Root Directory**: leave blank (repo root)
   - **Build Command**: `pnpm install --frozen-lockfile && pnpm --filter @manamap/api build`
   - **Start Command**: `cd apps/api && npx prisma migrate deploy && node dist/main`
7. [ ] In the API service → **Variables** tab, add every env var below (click "New Variable" for each):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | paste from Postgres service Connect tab |
   | `REDIS_URL` | paste from Redis service Connect tab |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | generate a 48-byte secret: run `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` in any terminal and paste the output |
   | `DISCORD_CLIENT_ID` | `1510362228526809199` |
   | `DISCORD_CLIENT_SECRET` | from Discord Developer Portal → your app → OAuth2 |
   | `DISCORD_REDIRECT_URI` | `manamap://auth/discord` |
   | `LOG_LEVEL` | `info` |
   | `CORS_ORIGIN` | leave blank for now — fill in after 1B |
   | `DEV_TOOLS` | do not set this at all — absence is the gate |

8. [ ] Click "Deploy" on the API service. Watch the deploy logs. The first deploy will run `prisma migrate deploy` which applies all migrations to the fresh Postgres DB. It should finish with "Listening on 0.0.0.0:3000".
9. [ ] In the API service → "Settings" → "Networking" → "Generate Domain". Copy the public URL (e.g. `https://manamap-api-production.up.railway.app`). This is your `EXPO_PUBLIC_API_URL`.
10. [ ] Smoke test: `curl https://YOUR-RAILWAY-URL.up.railway.app/api/v1/stores` — should return `[]` or a store list (not a 500 or connection error).

#### 1B — Vercel: Admin portal

1. [ ] Go to **vercel.com** → "Add New Project" → "Import Git Repository" → select `manamap`.
2. [ ] In project config:
   - **Framework Preset**: Vite (Vercel auto-detects it)
   - **Root Directory**: `apps/admin`
3. [ ] Add environment variables:
   - `VITE_API_URL` = `https://YOUR-RAILWAY-URL.up.railway.app/api`
   - `VITE_DISCORD_CLIENT_ID` = `1510362228526809199`
4. [ ] Click "Deploy". Copy the Vercel URL (e.g. `https://manamap-admin.vercel.app`).
5. [ ] **Back in Railway** → API service → Variables → set `CORS_ORIGIN` = `https://manamap-admin.vercel.app` (exact URL, no trailing slash). Redeploy the API service for the change to take effect.
6. [ ] **Discord Developer Portal** (discord.com/developers/applications → your app → OAuth2 → Redirects): add `https://manamap-admin.vercel.app/auth/callback`. Save.
7. [ ] **Also back in Vercel** → Settings → Environment Variables: add `VITE_DISCORD_REDIRECT_URI` = `https://manamap-admin.vercel.app/auth/callback`. Trigger a redeploy (Vercel → Deployments → "..." → Redeploy).
8. [ ] Open the admin portal URL in a browser → click Login → complete Discord OAuth → confirm you land on `/stores` without errors.

#### 1C — Seed production DB
- [ ] From your local machine (requires the production `DATABASE_URL` set temporarily as an env var or via a Railway CLI shell):
  ```bash
  # Set DATABASE_URL to the Railway Postgres connection string
  $env:DATABASE_URL = "postgresql://..." # (Windows PowerShell)
  pnpm --filter @manamap/api db:seed
  ```
  This seeds stores + badges. Alternatively, use Railway's "Connect" shell to run the seed command from there.

---

### Phase 2: EAS Build Pipeline

Work items 2A and 2C in parallel (both are registration steps with waiting periods).

#### 2A — Apple Developer Program (start immediately — up to 48 hrs)
1. [ ] Go to **developer.apple.com/programs/enroll** and sign in with your Apple ID.
2. [ ] Select "Individual" enrollment (unless you have a company entity).
3. [ ] Pay the $99/year fee. You get an email confirmation, usually within minutes, but full activation can take up to 48 hours if Apple does additional ID verification.
4. [ ] Once activated, go to **appstoreconnect.apple.com** → "Apps" → "+" → "New App":
   - Platform: iOS
   - Name: `ManaMap`
   - Primary Language: English
   - Bundle ID: `com.manamap.app` (select from the dropdown — Apple auto-creates it from your Developer account)
   - SKU: `manamap` (internal, never shown to users)
5. [ ] In the App record → "App Information" → scroll to "App Capabilities": enable **Push Notifications** and **Sign In with Apple**.
6. [ ] Create an **APNs Auth Key** (needed by EAS to send push notifications):
   - Go to **developer.apple.com** → "Certificates, Identifiers & Profiles" → "Keys" → "+" 
   - Name: `ManaMap APNs`, check "Apple Push Notifications service (APNs)"
   - Click "Continue" → "Register" → **Download the `.p8` file now** (you can only download it once)
   - Note the **Key ID** (10-char string shown on the key detail page) and your **Team ID** (top-right of developer.apple.com under your name)

#### 2B — Google Play Console
1. [ ] Go to **play.google.com/console** → "Create account" → pay the $25 one-time fee.
2. [ ] "Create app" → App name: `ManaMap` → Default language: English → App / Game: App → Free / Paid: Free → accept policies.
3. [ ] In Google Play Console → left sidebar → "Testing" → "Internal testing" → "Create new release". Leave it open — you'll upload the AAB here in Phase 3.

#### 2C — Google Maps API key (for Android)
1. [ ] Go to **console.cloud.google.com** → select or create a project → "APIs & Services" → "Enable APIs" → search for "Maps SDK for Android" → Enable.
2. [ ] "APIs & Services" → "Credentials" → "Create Credentials" → "API Key". Copy it.
3. [ ] Click "Restrict Key" → "Application restrictions" → "Android apps" → add your package name `com.manamap.app`. Save.
4. [ ] Store this key as an EAS secret (from `apps/mobile/` directory):
   ```bash
   npx eas-cli secret:create --scope project --name MAPS_API_KEY --value "YOUR_GOOGLE_MAPS_KEY"
   ```
5. [ ] In `apps/mobile/app.config.ts`, change the `googleMaps` line to read from the secret (EAS injects secrets as env vars at build time — the existing `process.env['MAPS_API_KEY']` reference is already correct).

#### 2D — EAS credentials setup
Run these from the `apps/mobile/` directory. EAS walks you through each step interactively.

1. [ ] Install EAS CLI if not already: `npm install -g eas-cli`
2. [ ] Log in: `eas login` (uses your Expo account — create one at expo.dev if needed)
3. [ ] **iOS credentials** — certificates + provisioning profile:
   ```bash
   cd apps/mobile
   eas credentials --platform ios
   ```
   Choose "Build Credentials" → "Set up a new build credential" → let EAS generate the distribution certificate and provisioning profile automatically (requires your Apple Developer account credentials when prompted).
4. [ ] **iOS push notifications** — upload the APNs key from 2A:
   ```bash
   eas credentials --platform ios
   ```
   Navigate to "Push Notifications" → "Add an APNs key" → enter the `.p8` file path, Key ID, and Team ID from step 2A.
5. [ ] **Android credentials** — keystore:
   ```bash
   eas credentials --platform android
   ```
   Choose "Build Credentials" → let EAS generate and store the keystore (keep the backup — you need the same keystore for every future release of this app).

#### 2E — Fill in Railway URL in eas.json
- [ ] Now that you have the Railway URL from Phase 1A step 9, open `apps/mobile/eas.json` and replace both `FILL_IN_AFTER_PHASE_1` placeholders with the actual Railway URL.

#### 2F — First preview build
From `apps/mobile/`:
```bash
eas build --platform all --profile preview
```
- This queues builds for both iOS and Android on EAS's build servers (20–60 min queue + build time).
- EAS sends an email when each build completes with an install link.
- [ ] **iOS**: install by opening the EAS link in Safari on your test device. Your Apple ID must be in the provisioning profile's test devices (EAS adds it if you used automatic provisioning).
- [ ] **Android**: download the APK from the EAS link and install it directly on a device (enable "Install from unknown sources" on the device if prompted).
- [ ] Test the critical path: Discord login → onboarding → store check-in → push notification opt-in prompt appears → life tracker Socket.IO connects (pod screen). Fix any API URL or CORS errors before submitting to stores.

---

### Phase 3: Beta Distribution

#### 3A — iOS: TestFlight internal testers (no Apple review, available immediately)
1. [ ] After the EAS preview/production build completes, submit it to App Store Connect:
   ```bash
   cd apps/mobile
   eas submit --platform ios --latest
   ```
   EAS will ask for your App Store Connect credentials (Apple ID + password, or better: an App Store Connect API key — create one at appstoreconnect.apple.com → Users and Access → Keys).
2. [ ] In **App Store Connect** → your app → "TestFlight" tab → wait for the build to finish processing (usually 5–15 min, shown as "Processing").
3. [ ] "Internal Testing" → "+" → add testers from your team by Apple ID email. Apple IDs must match an account in your App Store Connect team under "Users and Access". Up to 100 internal testers. They get an email; they install via the TestFlight app (free on the App Store).

#### 3B — iOS: TestFlight external testers (brief Apple review ~24 hrs)
1. [ ] "External Groups" → "+" → name the group (e.g. "Beta Testers").
2. [ ] Add the build to the group → click "Submit for Beta Review" → answer the export compliance questions (standard: No for encryption beyond HTTPS).
3. [ ] Apple reviews it (usually < 24 hrs for beta). Once approved, the group shows a public invite link you can share, or invite up to 10,000 testers by email.

#### 3C — Android: Internal Testing (no review, instant access)
Before `eas submit` can push to Google Play, you need a service account key:
1. [ ] In **Google Play Console** → Setup → "API access" → "Link to a Google Cloud project" → select the same project from 2C → "Create new service account" link (opens Google Cloud Console). In GCC: create a service account → "JSON" key type → download the JSON key file.
2. [ ] Back in Play Console → refresh the page → the service account appears → grant it "Release Manager" role.
3. [ ] Submit the Android build:
   ```bash
   cd apps/mobile
   eas submit --platform android --latest
   ```
   When prompted for the service account key, provide the path to the downloaded JSON file.
4. [ ] In **Google Play Console** → "Internal testing" → you should see the new release. Click "Promote to internal track" if it isn't there yet.
5. [ ] "Testers" tab → add a Google Group or paste individual Gmail addresses. Testers get an opt-in URL; after accepting it, the app appears in their Play Store.

---

### Phase 4: Production Hardening

These don't block beta but should be done before public launch.

- [ ] **Sentry error tracking**: Create a free project at **sentry.io** → "Create Project" → Node.js. Copy the DSN. Set `SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/xxx` in Railway env vars. Sentry is already instrumented in `apps/api/src/main.ts` — just the DSN is needed to activate it.
- [ ] **Database connection pooling**: Prisma opens a new connection per request under load. Append `?connection_limit=5&pool_timeout=10` to the `DATABASE_URL` in Railway to cap it at 5 connections. A shared Railway Postgres plan allows ~25 connections total; 5 leaves headroom for migrations and admin tools. Increase if you add more API instances.
- [ ] **Database backups**: Railway free-tier Postgres does not auto-backup. Either upgrade to a paid Railway plan (has point-in-time recovery) or set up a daily `pg_dump` via a Railway cron job / external service like Pipedream. Do this before beta traffic writes any real user data.
- [ ] **Confirm DEV_TOOLS is absent in production**: In Railway API service Variables tab, confirm there is NO `DEV_TOOLS` variable. If it exists and is set to `true`, the `/api/v1/dev/*` endpoints are live (bot manipulation, data reset). It must be absent or set to anything other than `"true"`.
- [ ] **OTA updates workflow** (post-launch, for JS-only fixes): When you fix a bug that touches only TypeScript/JS/assets (no new native modules or app.config.ts changes), publish an OTA update instead of submitting a new build:
  ```bash
  cd apps/mobile
  eas update --branch production --message "fix: describe the fix"
  ```
  Users get the fix silently on next app launch without going through App Store review. Requires the `updates.url` added in PF-5.
- [ ] **Custom domain** (optional, pre-launch): If you want `api.manamap.app` and `admin.manamap.app`:
  - Railway → API service → Settings → Networking → Custom Domain → add `api.manamap.app`. Railway gives you CNAME records to add at your DNS registrar. Railway handles TLS automatically.
  - Vercel → your project → Settings → Domains → add `admin.manamap.app`. Vercel gives you the same. TLS automatic.
  - After DNS propagates: update `VITE_API_URL` in Vercel, `CORS_ORIGIN` in Railway, and `EXPO_PUBLIC_API_URL` in `eas.json`, then rebuild and resubmit the mobile app.

---

### How we work an item
1. Design it in the prototype (`design/`) first when it has real UX — especially
   LFG, pod formation, moderation.
2. Turn the approved design into a grounded build prompt (reference real modules
   and file paths, state what's out of scope).
3. Build → review the PR → run acceptance checks → strike it off here.
