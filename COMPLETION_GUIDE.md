# manamap — Completion Guide

**Current status (June 2026):**
- API: ✅ fully built — 28 modules registered in `apps/api/src/app.module.ts`
- Mobile app: ✅ fully built — 15 screens, all components
- Admin portal: ✅ fully built — 11 pages (Moderation, Broadcast, Events, Stores, Offers, Redemption, etc.)
- Observability (M34): ✅ done — `nestjs-pino` + Sentry + `AllExceptionsFilter` wired in `app.module.ts` / `main.ts`
- Design prototype: 🔶 4 screens remaining (Stores, History, Life Tracker, Play Online)
- E2E tests (M33): ❌ not written — only unit tests exist in `__tests__/` folders

**How to use this file:**
- Phases 1 is for the **design agent** (paste prompts into your design session, not this repo).
- Phases 2–6 are for **Claude Code** (paste prompts directly into your repo session).
- Work top to bottom. Each step has a ✅ box — check it off as you go.

---

## Phase 1 — Close the design prototype
> **Tool: design agent, not Claude Code.**
> The native screens are already built. This phase completes the interactive prototype
> used for design review. After approval, the native code may need minor tweaks to match.

### 1.1 — Stores screen (M35)

**Prompt to paste into design agent:**
```
Build the Stores screen (M35) in the manamap prototype (manamap.html).

Reference `apps/mobile/src/screens/StoresScreen.tsx` for the full implementation.
Reference `PROMPTS.md` section M35 for the complete design spec.

Key states to include:
- Map view with store pins (confirmed = accent, proposed = grey)
- List view with text search
- StoreDetailSheet (bottom sheet) with:
  - Check-in button → acquiring → success / too-far / permission-denied errors
  - Schedule tab: events by day, EventRow with RSVP toggle (Going? / Going!),
    expandable attendee list (Here now + RSVP'd)
  - Leaderboard tab: ranked rows, user's own rank pinned if outside top
  - Who's here now (only when checked in at this store)
  - Proposed store: 0/3 confirmation progress bar + Confirm CTA
  - Reward modal: offer title + Redeem at counter → claim code + QR
- Event tag prompt modal (which event are you here for?)
- BadgeEarnedSheet overlay after check-in

Use the existing mock data patterns (MM.PLAYERS, store names from OB_STORES).
Wire the Stores tab or surface it from the Home quick-actions.
```

- [ ] Design reviewed and approved

---

### 1.2 — History / Encounters screen (M36)

**Prompt to paste into design agent:**
```
Build the History screen (M36) in the manamap prototype (manamap.html).

Reference `apps/mobile/src/screens/HistoryScreen.tsx` for the full implementation.
Reference `PROMPTS.md` section M36 for the design spec.

Key states to include:
- Section list: Today / This week / Earlier (sticky headers)
- EncounterCard: avatar, name, source badge with per-source colour
  (PRESENCE = brand accent, CONNECTION = green, GAME = purple),
  store name, relative timestamp, commander sub-line
- Crossed-paths nudge at top (conditional): "You've crossed paths with N players
  you haven't connected with yet"
- Empty state for first-time users
- Present as a bottom sheet (modal), tappable from You screen profile section

Use MM.PLAYERS and existing encounter types for mock data.
```

- [ ] Design reviewed and approved

---

### 1.3 — Life Tracker (M37)

**Prompt to paste into design agent:**
```
Build the Life Tracker screen (M37) in the manamap prototype (manamap.html).

Reference `apps/mobile/src/screens/LifeTrackerScreen.tsx` for the full implementation.
Reference `PROMPTS.md` section M37 for the design spec.

Key states to include:
- SetupSheet: 20 / 40 / Custom life total presets, Start button
- 2-player portrait: opponent rotated 180° top, self bottom (large 80pt life)
- 4-player 2×2 grid: compact panels (56pt life)
- PlayerPanel per player: colour dot, name, ±1/±5 buttons, poison/energy/experience
  counter row, commander damage row (expandable to CommanderDamageSheet)
- CommanderDamageSheet: per-source damage with ±1, danger at 18+
- GameBar: turn counter chip, active-player chip, monarch 👑 chip,
  undo / next-turn / reset buttons
- Eliminated state: greyed out + OUT label, restore button

Launch from inside a Pod screen via a "Start Life Tracker" button.
Use MM.PLAYERS for the 4-player mock.
```

- [ ] Design reviewed and approved

---

### 1.4 — Play Online sheet (M38)

**Prompt to paste into design agent:**
```
Build the Play Online sheet (M38) in the manamap prototype (manamap.html).

Reference `apps/mobile/src/components/PlayOnlineSheet.tsx` for the full implementation.
Reference `PROMPTS.md` section M38 for the design spec.

Key states to include:
- Platform picker: SpellTable | Convoke (segmented, icon + label)
- Room link input (placeholder adapts to platform)
- Connection picker: scrollable list with avatar, name, checkbox (multi-select)
  and empty state when no connections exist
- Send button (sticky footer): adapts label to selection count,
  disabled until link + ≥ 1 selection
- Success state: "N players will receive a notification with your room link."

Surface via a "Play Online" action on the You / Profile screen.
Use MM.CONNECTIONS for the mock connection list.
```

- [ ] Design reviewed and approved

---

## Phase 2 — Local integration testing
> **Tool: Claude Code (terminal).**
> Full walkthrough script is in `TESTING-M24.md`. Steps below are the critical path.

### Setup

```bash
# From repo root
docker compose up -d
pnpm --filter @manamap/api db:migrate
pnpm --filter @manamap/api db:seed

# Two terminals:
pnpm --filter @manamap/api dev        # API → http://localhost:3000
pnpm --filter @manamap/mobile dev     # Expo → follow QR

# Admin portal (optional, for moderation testing):
pnpm --filter @manamap/admin dev      # → http://localhost:5173
```

> GPS tip for check-in: use Android emulator Extended Controls → Location and enter
> a seeded store's lat/lng. Or add your address to `prisma/data/stores.json` and
> re-run `pnpm --filter @manamap/api db:seed:stores`. Full options in `TESTING-M24.md`.

### 2.1 — Core flow (sign in → check in → discover)

**Prompt to paste into Claude Code:**
```
Run the manamap API in test mode and verify the core flow works end-to-end.

1. Start the stack: docker compose up -d, run migrations, seed.
2. Dev-login as the primary test user (use POST /api/v1/auth/dev-login).
3. Complete onboarding (set displayName, avatarColors, homeStore).
4. Check in at a seeded store using POST /api/v1/presence/checkin with the
   store's lat/lng.
5. Verify GET /api/v1/discovery/nearby returns players (should be seeded bots
   after running the dev harness populate-store action).
6. Report any errors, missing routes, or unexpected 5xx responses.
```

- [ ] Sign in + onboarding working
- [ ] Check-in GPS gate passing with spoofed coordinates
- [ ] Nearby discovery returning players after dev harness populates store

### 2.2 — Full scene test (dev harness)

**Prompt to paste into Claude Code:**
```
Using the manamap dev harness, verify the full multi-user scene works.

With the API running and a user checked in, call POST /api/v1/dev/scene/full
(or use the in-app Dev panel). Then verify:

1. GET /api/v1/discovery/nearby — bot players appear
2. GET /api/v1/lfg — LFG sessions appear from bots
3. GET /api/v1/pods — a pod is visible
4. GET /api/v1/connections/requests — a bot has sent a connection request
5. Accept the request: POST /api/v1/connections/:id/accept
6. GET /api/v1/connections — new connection appears
7. A pending game arrives: GET /api/v1/games/pending
8. Confirm the game: POST /api/v1/games/:id/confirm
9. GET /api/v1/me/stats — W/L record has updated

Report any step that returns an error or unexpected empty response.
```

- [ ] LFG, pods, requests, connections all working end-to-end
- [ ] Game log → confirm → stats update working
- [ ] Push notifications firing (check Expo dev client notification tray)

### 2.3 — Admin portal

**Prompt to paste into Claude Code:**
```
Verify the admin portal works against the local API.

1. Open http://localhost:5173 (admin portal).
2. Log in with an ADMIN-role account (seed one if needed via prisma studio or
   a direct DB insert: UPDATE "User" SET role = 'ADMIN' WHERE email = '...').
3. Verify you can navigate to: Moderation, Stores, Events, Broadcast, Offers.
4. In the app: report a bot player (Profile → ... → Report).
5. In the admin portal Moderation page: find the report and action it (Warn).
6. Verify the warned player still appears in Discover (warn ≠ ban).
7. Action the same report again as Suspend; verify the player disappears from
   GET /api/v1/discovery/nearby.

Report any pages that fail to load or actions that return errors.
```

- [ ] Admin portal accessible and all pages load
- [ ] Report flow: submit in app → visible in admin → action takes effect

---

## Phase 3 — E2E test suite (M33)
> **Tool: Claude Code.**
> Unit tests exist in `apps/api/src/safety/__tests__/` and `apps/api/src/auth/__tests__/`.
> No E2E/integration tests exist yet. Pattern to follow: `@nestjs/testing` + `supertest`
> with a real test database (use `DATABASE_URL` pointing at a test DB).

**Prompt to paste into Claude Code:**
```
Write E2E integration tests for the manamap API (M33).

Create a new directory `apps/api/test/` with Jest e2e specs.
Follow the unit test pattern in `apps/api/src/safety/__tests__/safety.service.spec.ts`
but use @nestjs/testing createTestingModule with the full AppModule and supertest
for real HTTP calls against a test database.

Write tests covering these five flows. Each test should set up its own data and
clean up after itself.

Flow 1 — Auth + onboarding:
- POST /api/v1/auth/dev-login → 200, returns { accessToken, refreshToken }
- PATCH /api/v1/me with displayName, avatarColors, formats → 200
- GET /api/v1/me → returns completed profile with onboardedAt set

Flow 2 — Check-in + discovery:
- POST /api/v1/presence/checkin with a seeded store's lat/lng → 200
- GET /api/v1/discovery/nearby → 200, array (may be empty in test env)

Flow 3 — Connection lifecycle:
- Two users: alice and bob (both dev-login)
- Alice sends bob a request: POST /api/v1/connections/request with bob's exchangeToken
- Bob accepts: POST /api/v1/connections/:id/accept
- Both GET /api/v1/connections → each sees the other

Flow 4 — Game log + confirm:
- Alice logs a game with bob: POST /api/v1/games with roster [alice, bob], winnerId alice
- Bob sees it in GET /api/v1/games/pending
- Bob confirms: POST /api/v1/games/:id/confirm
- GET /api/v1/me/stats → alice has 1 win, bob has 1 loss

Flow 5 — Safety gate:
- Alice blocks bob: POST /api/v1/safety/block/:bobId
- GET /api/v1/discovery/nearby as alice → bob does not appear (reference
  existing safety.service.spec.ts for the block logic being tested)

Add a jest.config.e2e.js at apps/api/ and a package.json script "test:e2e".
Use a separate DATABASE_URL env var (e.g. TEST_DATABASE_URL) so e2e tests
never touch the dev database.
```

- [ ] E2E tests written and passing in CI
- [ ] `pnpm --filter @manamap/api test:e2e` exits 0

---

## Phase 4 — Observability (M34) ✅ Already done

Nothing to build. Verify it's working correctly:

**Prompt to paste into Claude Code:**
```
Verify M34 observability is working correctly in the manamap API.

Check each of the following and report any gaps:

1. Structured logging: start the API (pnpm --filter @manamap/api dev) and make
   a request. Confirm pino-pretty output appears in the terminal with method,
   url, statusCode, responseTime, and reqId fields.

2. Request ID correlation: make a request and check the response headers include
   x-request-id. Make another request with a custom X-Request-Id header and
   confirm the same ID echoes back.

3. Error capture: trigger a 500 by calling a non-existent route that would throw
   internally. Confirm the AllExceptionsFilter at
   apps/api/src/common/filters/all-exceptions.filter.ts logs the error with
   the requestId field and returns { statusCode, error, message, requestId }.

4. Sensitive field redaction: confirm that Authorization headers do NOT appear
   in logs (the redact config in app.module.ts covers req.headers.authorization).

5. Sentry (optional): if SENTRY_DSN is set in .env, trigger a 500 and confirm
   the event appears in your Sentry project dashboard.

Report any of the above that are missing or not working as described.
```

- [ ] Structured logging confirmed working
- [ ] Request ID echoed in response headers
- [ ] 500 errors captured with requestId in log output + response body
- [ ] Authorization header not appearing in logs

---

## Phase 5 — Physical device QA
> **Tool: manual testing on real hardware.**
> Run after Phase 2 passes on the emulator. Focus on hardware-specific behaviour.

**Prompt to paste into Claude Code (to prep the build):**
```
Prepare the manamap mobile app for physical device testing.

1. Check apps/mobile/.env (or app.config.ts) — confirm EXPO_PUBLIC_API_URL is
   set to the LAN IP of your dev machine, not localhost (physical devices cannot
   reach localhost).

2. Run: pnpm --filter @manamap/mobile build:dev-client
   (or expo prebuild + expo run:ios / expo run:android if using a dev client build)

3. Confirm the Expo push token is registered on device launch by checking
   POST /api/v1/me/push-token is called and returns 200 in the API logs.

4. Report any build errors or missing environment variables.
```

**Manual QA checklist — run through these on device:**

- [ ] **Push notifications** — trigger a connection request from a second device/account; notification arrives within 5 seconds
- [ ] **Check-in GPS gate** — stand outside or inside a real store; confirm "too far" error when outside 250m, success when inside
- [ ] **Life tracker WebSocket** — open a pod on two devices, start the life tracker, change life on one device and confirm it updates on the other within 1–2 seconds
- [ ] **Background/foreground cycle** — background the app during an LFG session, foreground it after 30 seconds; confirm LFG status is still live and not reset
- [ ] **Dark mode (Dusk theme)** — open the app on an OLED device; confirm no pure-white flashes during navigation transitions
- [ ] **Offline error states** — turn off Wi-Fi; tap Discover; confirm a graceful error message, not a crash or blank screen
- [ ] **QR scan** — scan another player's QR code on a real camera; confirm the player preview sheet opens correctly

---

## Phase 6 — Launch prep
> **Tool: Claude Code for config + scripts; manual for store submissions.**

### 6.1 — Production environment

**Prompt to paste into Claude Code:**
```
Prepare the manamap production environment configuration.

1. Create a file apps/api/.env.production.example listing every required
   environment variable with placeholder values and a comment explaining each.
   Base it on apps/api/src/config/config.schema.ts (the Zod schema that
   validates process.env at startup). Include at minimum:
   DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, DISCORD_CLIENT_ID,
   DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, EXPO_ACCESS_TOKEN,
   API_PORT, API_HOST, NODE_ENV, CORS_ORIGIN, SENTRY_DSN (optional).

2. Confirm NODE_ENV=production causes DevModule to not load (check the
   conditionalModules guard in apps/api/src/app.module.ts).

3. Confirm POST /api/v1/auth/dev-login returns 404 in production mode
   (check apps/api/src/auth/auth.controller.ts for the DEV guard).

4. Check apps/mobile/app.config.ts (or app.json) — confirm the production
   API URL, bundle ID (iOS) and applicationId (Android) are set correctly
   for release builds. These should not be localhost.

Report any missing variables, broken guards, or hardcoded localhost values.
```

- [ ] `.env.production.example` created with all required vars documented
- [ ] Dev endpoints return 404 with `NODE_ENV=production`
- [ ] Mobile bundle IDs correct for App Store / Play Store

### 6.2 — Production store data

**Prompt to paste into Claude Code:**
```
Verify the manamap store seeding is production-ready.

1. Check apps/api/prisma/data/stores.json — count how many stores are seeded.
   Are they real stores with real lat/lng, or test placeholders?

2. Check apps/api/prisma/seed-wpn.ts — this appears to import WPN store data.
   Confirm it runs without errors: pnpm --filter @manamap/api db:seed:wpn
   (or whatever the script name is in apps/api/package.json).

3. After seeding, run a quick SQL count:
   SELECT COUNT(*) FROM stores WHERE status = 'ACTIVE';
   Report the number.

4. Confirm that proposed stores (status = 'PROPOSED') require 3 confirmations
   to become ACTIVE — check apps/api/src/stores/stores.service.ts for the
   confirmation threshold logic.

Report any issues with the seed data or confirmation logic.
```

- [ ] Production store data seeded (WPN import verified)
- [ ] Proposed store confirmation threshold confirmed at 3

### 6.3 — App Store + Play Store submission

**Prompt to paste into Claude Code:**
```
List everything needed for App Store (iOS) and Play Store (Android) submission
for the manamap app. Check the current state of apps/mobile/ and report:

1. Does app.config.ts / app.json have: name, slug, version, ios.bundleIdentifier,
   android.package, ios.buildNumber, android.versionCode set?

2. Does the repo have an assets/ or app-store/ folder with:
   - App icon (1024×1024 PNG, no alpha)
   - Splash screen
   - At least 3 iPhone screenshots (6.5" display, 1284×2778 or 1290×2796)
   - At least 3 Android screenshots (1080×1920 or similar)

3. Is there an eas.json for Expo Application Services builds?
   If not, create a minimal one with development, preview, and production profiles.

4. Report any missing assets or config values that would block submission.
```

- [ ] `app.config.ts` has correct bundle IDs, version numbers
- [ ] App icon and splash screen assets present
- [ ] `eas.json` created with development / preview / production profiles
- [ ] Screenshots captured (use the design prototype or physical device)
- [ ] App Store Connect + Google Play Console listings created
- [ ] TestFlight (iOS) or Internal Testing (Android) build submitted

### 6.4 — Final production smoke test

**Prompt to paste into Claude Code:**
```
Run a final production smoke test against the deployed manamap API.

With the production API deployed (not localhost), verify:

1. GET https://your-api-domain.com/api/health → 200 { status: "ok" }
2. POST /api/v1/auth/dev-login → 404 (dev endpoint is blocked)
3. POST /api/v1/auth/discord → initiates Discord OAuth (don't complete it,
   just confirm the redirect URL is valid)
4. GET /api/v1/stores/pins?bbox=-180,-90,180,90 → 200, returns store pins array
5. Response headers include x-request-id on every response
6. No Authorization header values appear in server logs (Sentry or log drain)

Replace "your-api-domain.com" with the actual production URL.
Report any step that fails.
```

- [ ] Health endpoint returning 200 in production
- [ ] Dev endpoints blocked in production
- [ ] Store pins loading from production database
- [ ] Correlation IDs present on all responses
- [ ] Sensitive headers redacted in logs

---

## Summary checklist

| Phase | Item | Done |
|---|---|---|
| 1 | Stores screen designed + approved | ☐ |
| 1 | History screen designed + approved | ☐ |
| 1 | Life Tracker designed + approved | ☐ |
| 1 | Play Online sheet designed + approved | ☐ |
| 2 | Local stack running (docker + API + mobile) | ☐ |
| 2 | Dev harness full scene verified | ☐ |
| 2 | Admin portal verified end-to-end | ☐ |
| 3 | E2E tests written + passing | ☐ |
| 4 | Observability verified (logs, correlation IDs, Sentry) | ☐ |
| 5 | Push notifications on real device | ☐ |
| 5 | GPS check-in on real device | ☐ |
| 5 | Life tracker WebSocket on two real devices | ☐ |
| 5 | Offline error states confirmed (no crashes) | ☐ |
| 6 | Production env config documented | ☐ |
| 6 | WPN store data seeded | ☐ |
| 6 | App Store + Play Store assets ready | ☐ |
| 6 | `eas.json` production build profile created | ☐ |
| 6 | Production smoke test passing | ☐ |
