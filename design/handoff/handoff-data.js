// manamap build handoff — content. Attached to window.HANDOFF.
window.HANDOFF = {
  meta: [
    { k: 'Client', v: 'React Native (Expo)' },
    { k: 'Backend', v: 'NestJS · Node 20' },
    { k: 'Database', v: 'PostgreSQL + PostGIS' },
    { k: 'Scope', v: 'Phase 1 → 3' },
    { k: 'Build by', v: 'AI agent + review' },
  ],

  stack: [
    {
      layer: 'Mobile app', choice: 'Expo + EAS Dev Client', tags: ['react-native', 'typescript', 'expo-sdk'],
      why: 'Managed RN workflow but with a custom dev client so you can use native modules (BLE, camera, maps). Expo prebuild generates the native projects; EAS builds the binaries. Fastest path to a real iOS/Android app that still needs native code.',
      alt: 'Alt: bare React Native (more control, more setup). Avoid Expo Go — it can\u2019t load the native BLE/camera modules.',
    },
    {
      layer: 'Navigation & state', choice: 'React Navigation + TanStack Query', tags: ['native-stack', 'bottom-tabs', 'zustand'],
      why: 'Native-stack + bottom-tabs mirror the prototype\u2019s structure exactly. TanStack Query owns all server state (caching, retries, optimistic accepts); Zustand holds the little bit of pure client state (active venue, draft profile).',
      alt: 'Reanimated for the radar pulse + sheet transitions. Skip Redux — overkill here.',
    },
    {
      layer: 'In-person exchange', choice: 'Vision Camera + QR · BLE later', tags: ['vision-camera', 'qrcode-svg', 'ble-plx'],
      why: 'QR is the reliable primary: react-native-qrcode-svg renders your code, react-native-vision-camera scans theirs. BLE (react-native-ble-plx) is a Phase-1 enhancement layered on top of server presence, not the source of truth.',
      alt: 'See the BLE callout below — iOS background advertising is the constraint that shapes this whole feature.',
    },
    {
      layer: 'Maps', choice: 'react-native-maps', tags: ['apple-maps', 'google-maps'],
      why: 'Apple Maps on iOS, Google on Android, one component. Store pins + a bounding-box query is all the MVP needs. PostGIS does the geo work server-side.',
      alt: 'Move to Mapbox only if you need heavy custom map styling later.',
    },
    {
      layer: 'Backend', choice: 'NestJS (Node 20, TS)', tags: ['fastify-adapter', 'modular', 'openapi'],
      why: 'Module-per-domain structure (auth, profiles, discovery, stores, events, encounters, rewards) keeps the Phase-3 surface organized instead of one sprawling Express file. Generates OpenAPI for free; pairs cleanly with Prisma.',
      alt: 'Alt: Fastify alone if you want something leaner. NestJS earns its weight once rewards + partner portal land.',
    },
    {
      layer: 'ORM & database', choice: 'Prisma + PostgreSQL/PostGIS', tags: ['prisma', 'postgis', 'migrations'],
      why: 'Typed queries shared with the app via generated types. PostGIS handles "stores within this map region" and proximity. Geometry columns use raw SQL through Prisma\u2019s $queryRaw.',
      alt: 'Managed Postgres with PostGIS: Neon, Supabase (DB-only), or RDS. Local: docker-compose postgis image.',
    },
    {
      layer: 'Realtime & ephemeral', choice: 'Redis', tags: ['presence', 'rate-limit', 'tokens'],
      why: 'Holds venue presence (who\u2019s checked in, with TTL), rotating ephemeral exchange tokens, and rate-limit counters. Keeping this out of Postgres keeps "who\u2019s nearby" fast and self-expiring.',
      alt: 'BullMQ (Redis-backed) for jobs: streak recalculation, badge awards, push fan-out.',
    },
    {
      layer: 'Auth', choice: 'Sign in with Apple + Discord OAuth', tags: ['jwt', 'oauth2', 'secure-store'],
      why: 'Sign in with Apple is effectively required for App Store if you offer any social login. Discord OAuth doubles as the contact backbone — link once, and "share Discord on connect" becomes trustworthy (verified handle, not free text).',
      alt: 'Tokens: short JWT access + rotating refresh in expo-secure-store. Add email OTP later if you want a no-Discord path.',
    },
    {
      layer: 'Notifications', choice: 'Expo Notifications', tags: ['apns', 'fcm', 'push'],
      why: 'One API over APNs + FCM. Drives the core loop: "X wants to connect", "X accepted", "you\u2019re both at Dragon\u2019s Den".',
      alt: 'Server sends via expo-server-sdk from a BullMQ worker.',
    },
    {
      layer: 'Repo & infra', choice: 'pnpm + Turborepo monorepo', tags: ['docker', 'github-actions', 'eas'],
      why: 'apps/mobile, apps/api, packages/shared (zod schemas + TS types both sides import). Docker-compose for local Postgres/Redis. GitHub Actions for CI; EAS for app binaries; Fly.io or Railway for the API.',
      alt: 'Keep shared validation in one place — it\u2019s the thing that stops client/server drift.',
    },
  ],

  layers: [
    { name: 'Mobile', bits: ['Expo RN', 'React Navigation', 'TanStack Query', 'Vision Camera', 'react-native-maps', 'BLE (enhancement)'] },
    { name: 'Edge', bits: ['HTTPS REST /v1', 'JWT auth', 'Expo Push'] },
    { name: 'API', bits: ['NestJS modules', 'zod validation', 'OpenAPI'] },
    { name: 'Services', bits: ['Presence (Redis TTL)', 'Exchange tokens', 'BullMQ jobs', 'Rate limit'] },
    { name: 'Data', bits: ['PostgreSQL', 'PostGIS geo', 'Prisma'] },
    { name: 'External', bits: ['Apple Sign-In', 'Discord OAuth', 'APNs / FCM', 'Moxfield / Archidekt (links)'] },
  ],

  callouts: [
    {
      kind: 'warn', ico: '📡', t: 'BLE on iOS is the load-bearing constraint — design around it',
      d: 'iOS heavily restricts advertising custom BLE service UUIDs in the background, so reliable peer-to-peer "who\u2019s near me" purely over Bluetooth is not achievable. Decision: make <b>store-session presence the source of truth</b> for the Discover radar — when a player checks in (manually or via geofence), the server knows who is present at that venue. BLE becomes an opt-in foreground refinement (rough distance ordering while both apps are open), and QR is the deterministic exchange. This is simpler, more private, and matches the store-centric product model.',
    },
    {
      kind: 'info', ico: '🔒', t: 'Contact data is connection-gated at the API, not just the UI',
      d: 'Discord handle and deck links must never appear in a discovery or preview response. The <code>/discovery</code> and public-profile endpoints return only public fields; contact fields are served exclusively by <code>/connections/:id</code> once status is <code>accepted</code> AND the owner\u2019s privacy flags allow it. The blurred "locked" panel in the prototype is a real authorization boundary.',
    },
    {
      kind: 'info', ico: '🎲', t: 'Ephemeral, rotating exchange tokens — never broadcast a stable user id',
      d: 'QR codes and BLE payloads carry a short-lived opaque token (Redis, ~60s TTL) that resolves server-side to a user. This prevents someone from screenshotting a code to track or impersonate a player, and lets a user revoke a leaked code instantly.',
    },
  ],

  tables: [
    { name: 'users', note: 'core', fields: [
      ['id', 'uuid pk'], ['handle', 'citext uniq'], ['display_name', 'text'], ['pronouns', 'text?'],
      ['bio', 'text?'], ['avatar_colors', 'text[] WUBRG'], ['power_level', 'int?'], ['vibe', 'text?'],
      ['commander', 'text?'], ['home_store_id', 'uuid fk?'], ['created_at', 'timestamptz'],
    ]},
    { name: 'identities', note: 'auth', fields: [
      ['id', 'uuid pk'], ['user_id', 'uuid fk'], ['provider', 'enum apple|discord'],
      ['provider_uid', 'text'], ['discord_handle', 'text?'], ['access_scope', 'text?'],
    ]},
    { name: 'privacy_settings', note: '1:1 users', fields: [
      ['user_id', 'uuid pk fk'], ['discoverable', 'bool'], ['show_discord', 'bool'],
      ['show_decks', 'bool'], ['show_met_history', 'bool'],
    ]},
    { name: 'formats', note: 'user ↔ format', fields: [
      ['user_id', 'uuid fk'], ['format', 'text'], ['pk', '(user_id, format)'],
    ]},
    { name: 'deck_links', note: 'gated', fields: [
      ['id', 'uuid pk'], ['user_id', 'uuid fk'], ['site', 'enum moxfield|archidekt'],
      ['name', 'text'], ['url', 'text'], ['sort', 'int'],
    ]},
    { name: 'connections', note: 'the core edge', fields: [
      ['id', 'uuid pk'], ['requester_id', 'uuid fk'], ['addressee_id', 'uuid fk'],
      ['status', 'enum pending|accepted|declined'], ['via', 'enum qr|ble|nearby'],
      ['note', 'text?'], ['created_at', 'timestamptz'], ['responded_at', 'timestamptz?'],
      ['uniq', '(least,greatest) pair'],
    ]},
    { name: 'encounters', note: '"met before" log', fields: [
      ['id', 'uuid pk'], ['user_a', 'uuid fk'], ['user_b', 'uuid fk'],
      ['store_id', 'uuid fk?'], ['source', 'enum checkin|connect'], ['met_at', 'timestamptz'],
    ]},
    { name: 'stores', note: 'PostGIS', fields: [
      ['id', 'uuid pk'], ['name', 'text'], ['address', 'text'], ['geom', 'geography(Point)'],
      ['discord_url', 'text?'], ['is_partner', 'bool'], ['timezone', 'text'],
    ]},
    { name: 'checkins', note: 'presence + history', fields: [
      ['id', 'uuid pk'], ['user_id', 'uuid fk'], ['store_id', 'uuid fk'],
      ['checked_in_at', 'timestamptz'], ['source', 'enum manual|geofence'],
    ]},
    { name: 'events', note: 'Phase 2', fields: [
      ['id', 'uuid pk'], ['store_id', 'uuid fk'], ['title', 'text'], ['format', 'text?'],
      ['starts_at', 'timestamptz'], ['discord_channel_url', 'text?'], ['source', 'enum store|discord|wizards'],
    ]},
    { name: 'badges / user_badges', note: 'Phase 3', fields: [
      ['code', 'text pk'], ['name', 'text'], ['criteria', 'jsonb'],
      ['— user_badges —', ''], ['user_id+code', 'pk'], ['earned_at', 'timestamptz'],
    ]},
    { name: 'streaks', note: 'Phase 3', fields: [
      ['user_id', 'uuid fk'], ['store_id', 'uuid fk'], ['count', 'int'],
      ['last_visit', 'date'], ['pk', '(user_id, store_id)'],
    ]},
    { name: 'reward_offers', note: 'Phase 3 partner', fields: [
      ['id', 'uuid pk'], ['store_id', 'uuid fk'], ['title', 'text'], ['type', 'enum first_visit|streak'],
      ['terms', 'text'], ['active', 'bool'],
    ]},
  ],

  api: [
    { group: 'Auth', color: 'var(--U)', routes: [
      ['POST', '/v1/auth/apple', 'exchange Apple identity token'],
      ['POST', '/v1/auth/discord', 'OAuth code → session'],
      ['POST', '/v1/auth/refresh', 'rotate refresh token'],
      ['POST', '/v1/auth/logout', 'revoke refresh token'],
    ]},
    { group: 'Me & profile', color: 'var(--R)', routes: [
      ['GET', '/v1/me', 'full own profile + privacy'],
      ['PATCH', '/v1/me', 'edit profile / colors / formats'],
      ['PATCH', '/v1/me/privacy', 'toggle privacy flags'],
      ['GET', '/v1/me/decks', 'list deck links'],
      ['POST', '/v1/me/decks', 'add deck link'],
      ['DELETE', '/v1/me/decks/:id', 'remove deck link'],
    ]},
    { group: 'Discovery & exchange', color: 'var(--G)', routes: [
      ['POST', '/v1/presence/heartbeat', 'I\u2019m at store X (TTL)'],
      ['GET', '/v1/discovery/nearby', 'others present here (public fields)'],
      ['POST', '/v1/exchange/token', 'mint my rotating QR/BLE token'],
      ['POST', '/v1/exchange/resolve', 'scanned token → public profile'],
    ]},
    { group: 'Connections', color: 'var(--B)', routes: [
      ['POST', '/v1/connections', 'send request (via, note)'],
      ['GET', '/v1/connections', 'requests + accepted lists'],
      ['POST', '/v1/connections/:id/accept', 'accept → unlock contact'],
      ['POST', '/v1/connections/:id/decline', 'decline'],
      ['GET', '/v1/connections/:id', 'full card + gated contact'],
    ]},
    { group: 'Stores & events', color: 'var(--W)', routes: [
      ['GET', '/v1/stores?bbox=', 'pins within map region (PostGIS)'],
      ['GET', '/v1/stores/:id', 'store detail'],
      ['POST', '/v1/stores/:id/checkin', 'manual check-in'],
      ['GET', '/v1/stores/:id/events', 'event calendar'],
      ['GET', '/v1/encounters', '"met before" history'],
    ]},
    { group: 'Rewards (Phase 3)', color: 'var(--brand)', routes: [
      ['GET', '/v1/me/badges', 'earned badges'],
      ['GET', '/v1/stores/:id/leaderboard', 'local leaderboard'],
      ['GET', '/v1/stores/:id/offers', 'active reward offers'],
      ['POST', '/v1/admin/stores/:id/offers', 'partner: create offer'],
    ]},
  ],

  phases: [
    {
      ptag: 'PHASE 0', title: 'Foundations', goal: 'Repo, backend, auth, app shell',
      milestones: [
        {
          code: 'M0', title: 'Monorepo & tooling', deps: null,
          goal: 'Stand up the pnpm + Turborepo workspace, shared types package, and local infra before any feature code.',
          prompt: `Set up a pnpm + Turborepo monorepo named "manamap" with TypeScript strict mode throughout. Create three workspaces:
- apps/mobile (empty for now)
- apps/api (empty for now)
- packages/shared — exports zod schemas + inferred TS types; both apps import from here

Add: root tsconfig base, ESLint + Prettier, a docker-compose.yml running postgres:16 with the PostGIS extension and redis:7, and a .env.example. Configure Turborepo pipelines (build, lint, typecheck, dev). Write a README with setup steps. Do NOT scaffold any screens or endpoints yet — just the skeleton, and confirm \`pnpm install\` + \`docker compose up\` + \`pnpm typecheck\` all pass.`,
          deliverables: ['pnpm/Turborepo workspace', 'packages/shared with zod', 'docker-compose: postgis + redis', 'ESLint/Prettier/tsconfig', 'README'],
          acceptance: ['pnpm install succeeds', 'docker compose up brings up db + redis', 'pnpm typecheck is green'],
        },
        {
          code: 'M1', title: 'API skeleton + Prisma', deps: 'M0',
          goal: 'NestJS app with Prisma, the full schema migrated, health check, and config validation.',
          prompt: `In apps/api, scaffold a NestJS app (Fastify adapter) with config validation (zod) and a /health endpoint. Add Prisma with a PostgreSQL datasource and enable the PostGIS extension via a migration. Implement the FULL data model from the handoff (users, identities, privacy_settings, formats, deck_links, connections, encounters, stores with a geography(Point) geom column, checkins, events, badges, user_badges, streaks, reward_offers) as Prisma models — use $queryRaw for the geom column where Prisma can\u2019t express PostGIS types. Generate and run migrations. Add a seed script that inserts ~6 demo users and 3 stores (matching the prototype data). Wire a global validation pipe using the zod schemas from packages/shared. Do NOT build auth or feature endpoints yet.`,
          deliverables: ['NestJS + Fastify app', 'Prisma schema (all tables)', 'PostGIS migration', 'seed script', '/health + config validation'],
          acceptance: ['migrations apply cleanly', 'seed populates demo data', 'GET /health returns 200', 'geom column queryable'],
        },
        {
          code: 'M2', title: 'Auth: Apple + Discord', deps: 'M1',
          goal: 'Sign in with Apple and Discord OAuth, JWT access/refresh, and the identities table wired up.',
          prompt: `Implement an Auth module in apps/api. Support two providers:
1. Sign in with Apple — verify the Apple identity token, upsert a user + identities row.
2. Discord OAuth2 — exchange the auth code, fetch the Discord profile, store the verified discord_handle on the identity (this is what powers "share Discord on connect").

Issue a short-lived JWT access token (15m) and a rotating refresh token (store a hash; rotate on use; support revoke). Endpoints: POST /v1/auth/apple, POST /v1/auth/discord, POST /v1/auth/refresh, POST /v1/auth/logout. Add an AuthGuard that populates req.user from the access token. Validate all bodies with shared zod schemas and add unit tests for token issuance + rotation. Do NOT build the mobile auth UI in this milestone.`,
          deliverables: ['Apple + Discord verification', 'JWT access + rotating refresh', 'AuthGuard', 'auth endpoints', 'token tests'],
          acceptance: ['both providers upsert a user', 'refresh rotates + old token rejected', 'guarded route 401s without token'],
        },
        {
          code: 'M3', title: 'Mobile shell + design system', deps: 'M2',
          goal: 'Expo app with the manamap design tokens, navigation, query client, secure auth storage, and login.',
          prompt: `In apps/mobile, initialize an Expo app (TypeScript) configured with EAS + a custom dev client (config plugins, NOT Expo Go). Port the manamap design system from the prototype into a theme module: the warm "Soft paper" palette, the WUBRG mana colors, Plus Jakarta Sans, radii/shadow tokens, and a <ManaPip>, <Avatar>, and <Chip> component. Set up React Navigation (bottom tabs: Discover / Connect / You + a Scan action; native-stack for pushed screens), a TanStack Query client, and an auth flow: a sign-in screen (Apple + Discord buttons) that calls the API and stores tokens in expo-secure-store, with an axios/fetch wrapper that attaches the access token and refreshes on 401. Land on an empty Discover tab when authed. Match the prototype's look. Do NOT build feature screens beyond placeholders yet.`,
          deliverables: ['Expo + EAS dev client', 'theme + ManaPip/Avatar/Chip', 'tab + stack navigation', 'auth screen + token storage', 'authed fetch wrapper'],
          acceptance: ['app builds on a dev client', 'Apple/Discord sign-in returns to authed tabs', '401 triggers silent refresh'],
        },
      ],
    },
    {
      ptag: 'PHASE 1', title: 'Core MVP', goal: 'The flow you prototyped',
      milestones: [
        {
          code: 'M4', title: 'Player profile & privacy', deps: 'M3',
          goal: 'The card you exchange: profile CRUD, formats, deck links, privacy toggles, end to end.',
          prompt: `Build the player profile feature end to end. API: GET/PATCH /v1/me (display_name, pronouns, bio, avatar_colors WUBRG, commander, power_level, vibe, formats), PATCH /v1/me/privacy (discoverable, show_discord, show_decks, show_met_history), and CRUD for /v1/me/decks (site enum moxfield|archidekt + name + url, validate the URL host). Mobile: the "You" tab — render the player card (start with the "Profile" card style from the prototype), an edit form, working privacy switches (persisted via the API), the deck-links list, and the home-store row. Use the shared zod schemas for the form. Optimistically update the privacy toggles via TanStack Query.`,
          deliverables: ['/me + /me/privacy + /me/decks', 'You tab card + edit form', 'privacy switches', 'deck link management'],
          acceptance: ['profile edits persist + refetch', 'privacy toggles round-trip', 'deck URL host validated'],
        },
        {
          code: 'M5', title: 'QR exchange', deps: 'M4',
          goal: 'Mint a rotating token, render it as a QR, scan another player\u2019s, resolve to a public profile.',
          prompt: `Implement the QR exchange. API: POST /v1/exchange/token mints a short-lived (~60s) opaque token in Redis bound to the caller; POST /v1/exchange/resolve takes a scanned token and returns the target's PUBLIC profile only (no Discord, no decks). Mobile: the Scan sheet from the prototype with two modes — "My code" (render the token via react-native-qrcode-svg, auto-refresh before TTL, avatar in the center) and "Scan" (react-native-vision-camera reading QR). On a successful scan, navigate to the scanned player's preview screen (public card + a locked/blurred contact panel + "Send connect request"). Handle camera permission + expired-token states gracefully.`,
          deliverables: ['exchange token mint/resolve (Redis TTL)', 'QR generate + camera scan', 'Scan sheet (My code / Scan)', 'public preview screen'],
          acceptance: ['scanning a code opens that player\u2019s preview', 'tokens expire + refresh', 'resolve never returns contact fields'],
        },
        {
          code: 'M6', title: 'Connections & approval', deps: 'M5',
          goal: 'Request → accept/decline → unlock contact, with push notifications and the connected reveal.',
          prompt: `Build the connection/approval flow — the heart of the app. API: POST /v1/connections (addressee + via + optional note, dedupe by unordered pair), GET /v1/connections (pending requests + accepted list), POST /v1/connections/:id/accept and /decline, GET /v1/connections/:id (full card; include Discord + deck links ONLY if status=accepted AND the owner's privacy flags allow). On accept, write an encounters row and send Expo push to both users. Mobile: the "Connect" tab (incoming requests with Accept/Decline, optimistic; accepted connections list), the "Connected!" reveal screen (gradient header, both avatars, now-unlocked Discord + deck links with copy/open), and wire "Send connect request" from the preview. Register for push + handle the "X wants to connect / accepted" notifications.`,
          deliverables: ['connection request/accept/decline API', 'contact-gating in /connections/:id', 'Connect tab + Connected reveal', 'Expo push on request + accept'],
          acceptance: ['contact hidden until accepted + allowed', 'accept creates encounter + notifies', 'duplicate pair rejected'],
        },
        {
          code: 'M7', title: 'Presence-based Discover + BLE polish', deps: 'M6',
          goal: 'The radar: who\u2019s checked in here right now, with optional BLE distance ordering.',
          prompt: `Implement Discover on top of store presence (NOT raw BLE). API: POST /v1/presence/heartbeat (user asserts they're at store X; store in Redis with a TTL, refresh on interval), GET /v1/discovery/nearby (others currently present at the caller's active store, PUBLIC fields + a "met before" flag derived from encounters, respecting the target's discoverable flag). Mobile: the Discover tab from the prototype — the active-store header, the radar visualization (place present players around the center), the player list (Everyone / Met before filter), tapping a player → preview. Send heartbeats while the app is foregrounded at a venue. THEN add BLE as an enhancement: while foregrounded, use react-native-ble-plx to roughly order/annotate nearby players by signal — gracefully no-op if unsupported or denied. Document the iOS background-advertising limitation in code comments.`,
          deliverables: ['presence heartbeat + nearby (Redis)', 'Discover radar + list + filter', 'discoverable-flag respected', 'BLE foreground enhancement (optional)'],
          acceptance: ['nearby reflects current check-ins w/ TTL', 'non-discoverable users excluded', 'BLE degrades gracefully when unavailable'],
        },
        {
          code: 'M8', title: 'Store directory & map', deps: 'M7',
          goal: 'Searchable stores, a map of pins via PostGIS, and manual check-in.',
          prompt: `Build the store directory + map. API: GET /v1/stores?bbox=minLng,minLat,maxLng,maxLat (PostGIS ST_MakeEnvelope + ST_Intersects against geom, returns pins), GET /v1/stores/:id (detail), POST /v1/stores/:id/checkin (manual check-in → writes checkins + starts a presence session). Mobile: a Stores screen with react-native-maps showing pins for the visible region (refetch on region change, debounced), a searchable list, a store detail sheet (name, address, Discord link, "check in" button), and set the user's active venue on check-in so Discover (M7) lights up. Add a "home store" setter on the profile.`,
          deliverables: ['bbox store query (PostGIS)', 'store detail + manual check-in', 'map + searchable list', 'check-in sets active venue'],
          acceptance: ['pins load for visible region', 'check-in writes row + activates presence', 'search filters the list'],
        },
      ],
    },
    {
      ptag: 'PHASE 2', title: 'Local community', goal: 'Events, history, store depth',
      milestones: [
        {
          code: 'M9', title: 'Store pages & events', deps: 'M8',
          goal: 'Store detail pages with an event calendar and Discord/event quick-access.',
          prompt: `Expand stores into full community hubs. API: GET /v1/stores/:id/events (calendar; model events with source store|discord|wizards), and an ingestion seam — start with manual/store-entered events and a Discord-link field; stub the connectors for Discord event channels and Wizards feeds behind an interface so they can be implemented later. Mobile: a richer store detail page (schedule list grouped by day, format tags, "open Discord" / "join event channel" buttons, who's checked in now). Add a "shared event" indicator on player previews when you and they are both attending the same upcoming event.`,
          deliverables: ['events API + calendar', 'store detail w/ schedule', 'Discord/event quick links', 'shared-event indicator', 'connector interface (stubbed)'],
          acceptance: ['events render grouped by day', 'shared-event flag computed correctly', 'connectors swappable behind interface'],
        },
        {
          code: 'M10', title: 'Encounter history', deps: 'M9',
          goal: '"Met before" logs and recent player sightings, surfaced respectfully.',
          prompt: `Build encounter history. API: GET /v1/encounters (the caller's "met before" log — who, which store, when, source), and ensure encounters are written on both connect AND co-presence at a store (dedupe sensibly, e.g. once per store per day). Respect the show_met_history privacy flag. Mobile: a "history" view (recent sightings + met-at-store cards), and enrich the Discover "met before" badge and the preview's "you met at X" banner using this data. Add a quiet "you've crossed paths with N players you haven't connected with" nudge — never expose identities of non-discoverable users.`,
          deliverables: ['encounters API + dedupe', 'co-presence encounter writes', 'history view', 'met-before enrichment', 'privacy-respecting nudge'],
          acceptance: ['encounters dedupe per store/day', 'show_met_history respected', 'non-discoverable users never surfaced'],
        },
      ],
    },
    {
      ptag: 'PHASE 3', title: 'Rewards & retention', goal: 'Gamification + partners',
      milestones: [
        {
          code: 'M11', title: 'Check-in gamification', deps: 'M10',
          goal: 'First-visit badges, repeat-visit streaks, and a local leaderboard.',
          prompt: `Add check-in gamification. Model badges (code, name, criteria jsonb) + user_badges, and streaks (per user per store). On check-in, run a BullMQ job that: awards first-visit/store badges, updates the streak (increment if within the cadence window, else reset), and recomputes the store leaderboard. API: GET /v1/me/badges, GET /v1/stores/:id/leaderboard (top check-in streaks/counts, privacy-aware). Mobile: a rewards section on the profile (earned badges, current streaks), a celebratory toast/sheet when a badge is earned, and a leaderboard view on the store page. Keep criteria data-driven so new badges don't need a deploy.`,
          deliverables: ['badges + streaks model', 'award/streak/leaderboard job (BullMQ)', 'badges + leaderboard API', 'rewards UI + earn celebration'],
          acceptance: ['first check-in awards a badge', 'streak increments + resets correctly', 'leaderboard respects privacy'],
        },
        {
          code: 'M12', title: 'Store partner program', deps: 'M11',
          goal: 'Store opt-in reward offers, first-visit promos, and an admin onboarding portal.',
          prompt: `Build the partner program. API: admin endpoints (separate role/guard) for stores to register, manage their profile, and CRUD reward_offers (type first_visit|streak, terms, active). Tie offer redemption to check-in events. Build a lightweight web admin portal (a new apps/admin — Next.js or Vite + React, reuse packages/shared) for store owners: claim/onboard a store, set up offers, view basic check-in analytics. Mobile: surface active offers on store pages and a "first-time check-in promo" prompt for new visitors. Keep reward fulfillment manual-redeem for v1 (show a code/QR to staff) rather than payments.`,
          deliverables: ['partner role + admin guard', 'reward_offers CRUD', 'apps/admin web portal', 'offer surfacing + first-visit promo'],
          acceptance: ['store owner can onboard + create an offer', 'offers appear on the store page', 'admin actions are role-guarded'],
        },
        {
          code: 'M13', title: 'Advanced discovery', deps: 'M12',
          goal: 'Matchmaking suggestions and format/deck-based nearby filters.',
          prompt: `Add advanced discovery. API: extend GET /v1/discovery/nearby with filters (format, color identity / WUBRG overlap, power-level range, vibe), and add GET /v1/discovery/suggestions — a matchmaking ranker that scores present players against the caller (shared formats, complementary/compatible power level, "haven't connected yet", past positive encounters). Keep the scoring weights config-driven. Mobile: filter controls on Discover (format chips, mana-color filter, power range) and a "good matches here" carousel on top of the radar. Make it explainable — each suggestion shows WHY ("also plays Commander · similar power").`,
          deliverables: ['nearby filters (format/colors/power/vibe)', 'matchmaking suggestions ranker', 'Discover filter UI + matches carousel', 'explainable match reasons'],
          acceptance: ['filters narrow results correctly', 'suggestions exclude existing connections', 'each match shows a reason'],
        },
      ],
    },
  ],

  risks: [
    { ico: '📡', t: 'iOS BLE limits', d: 'Don\u2019t let "nearby" depend on background BLE advertising — it won\u2019t work on iOS. Presence is the source of truth; validate the BLE foreground enhancement on real devices early in M7.' },
    { ico: '🔑', t: 'Apple Sign-In requirement', d: 'Offering Discord login likely triggers Apple\u2019s "must also offer Sign in with Apple" review rule. Ship both from M2 to avoid a rejection late.' },
    { ico: '🗺️', t: 'Store data cold-start', d: 'The map is empty without stores. Decide the seeding strategy: hand-curate launch-city stores, or let owners self-register via the M12 portal. This gates the value of Discover.' },
    { ico: '🔌', t: 'Event source integrations', d: 'Discord event channels and Wizards feeds have no clean public API. Keep them behind the M9 connector interface; ship store-entered + Discord-link events first.' },
    { ico: '🛡️', t: 'Safety & blocking', d: 'In-person discovery needs block/report and a hard "go invisible" switch from day one. Fold a block list into M6 (connections) even though it\u2019s not in the roadmap text.' },
    { ico: '📍', t: 'Location & battery', d: 'Geofenced auto check-in is great UX but costs battery and permissions. Start with manual check-in (M8); treat geofencing as a later opt-in.' },
  ],
};
