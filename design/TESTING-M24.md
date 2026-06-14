# Testing manamap solo with the M24 dev harness

How to exercise every screen by yourself once **M24 (simulated users / dev harness)**
is built. Grounded in the repo's real setup (dev-login, seeded accounts, emulator URL).

> All of this is **dev-only**. The dev routes and the in-app Dev panel are gated on
> `NODE_ENV !== 'production'` (the same guard the existing `POST /v1/auth/dev-login`
> already uses). None of it ships to production.

---

## 0. One-time setup

```bash
# from repo root
docker compose up -d                      # postgres + redis  (or your local DB/Redis)
pnpm --filter @manamap/api db:migrate     # apply the M24 isBot migration
pnpm --filter @manamap/api db:seed        # seed formats, stores, badges, bot users
```

Run the API and the app (two terminals):
```bash
pnpm --filter @manamap/api dev            # API on http://localhost:3000  (prefix /api)
pnpm --filter @manamap/mobile dev         # expo start --dev-client
```

- **Android emulator** already points at the host via `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`.
- **iOS simulator**: set `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- **Physical device**: set it to your machine's LAN IP, e.g. `http://192.168.x.x:3000`.

Seeded bot accounts (from `prisma/seed.ts`, all `@example.com`):
`ghalta` (G), `marchesa` (UBR), `giada` (W), `krenko` (R), `tatyova` (UG) — plus the
extra bots M24 adds. These are the players who will appear around you.

---

## 1. Sign in as yourself

Use the existing dev bypass so you're not stuck behind OAuth:

- In the app's Dev panel (or sign-in dev shortcut) call `POST /api/v1/auth/dev-login`
  with your own seeded email, **or** sign in with Discord normally.
- Complete onboarding once (name, colors, formats, home store) so you have a real card.
- **Check in** at a store (the map / Stores tab). This sets your active venue — the
  harness drops bots at *your current store*, so this step matters.

---

## 2. Make everything come alive

Open the **Dev panel** (hidden entry — e.g. long-press the You-tab header) and tap
**Full scene**. Behind it, the harness drives the real services as the bots:

| Button | What it calls (as bots) | Where it shows up for you |
|---|---|---|
| **Populate store** | `presence.heartbeat` + `lfg.create` | Discover radar + LFG "open to play" list |
| **Host a pod** | `pods.create` | "Pods forming here" on Discover |
| **Send me a request** | `connections.sendRequest → you` | Connect tab → Requests (+ push) |
| **Accept my requests** | bots `connections.accept` | your pending → Connections |
| **Log a game with me** | `games.create` incl. you | Connect tab → Confirm results |
| **Full scene** | all of the above in sequence | everything at once |
| **Reset** | clears bot presence/LFG/pods/requests/pending games | back to a clean slate |

Because these go through the **real services**, the safety/discoverable/TTL rules all
apply — a blocked or invisible bot genuinely won't appear, sessions expire on their
TTL, etc. It behaves exactly like production traffic.

---

## 3. Walk every screen (suggested loop)

1. **Discover** — radar + nearby list populated; tap a bot → **Player preview**
   (locked contact). Send a connect request.
2. **Connect → Requests** — accept a bot's request → **Connected reveal** (Discord +
   decks unlock). Tap a connection → **Connection detail**.
3. **LFG** — tap **Open to play now**, set format/power/seats → your live status with
   countdown; **Edit** / **Stop**.
4. **Pods** — open a bot's pod → **Ask to join**; or **Start a pod**, then use *Send
   me a request* so a bot asks to join and you **Approve** the seat → **Pod ready**.
5. **Log a game** — from a full pod's "Log result" (or You-tab standalone): roster →
   decks → winner → confirm. Then check **You → Game record** (stats move) and
   **Connect → Confirm results** (a bot-logged game waiting for you).
6. **You** — card, privacy toggles, **Go invisible** (re-run *Populate store* and
   confirm you'd be hidden), home store, game stats + recent games.
7. **Stores** — map pins, store detail, **check in** (proximity-gated — test the
   "too far" path by faking a distant location in the emulator's location controls),
   leaderboards (check-in streaks + games-won), events.
8. **Admin portal** (`pnpm --filter @manamap/admin dev`, `http://localhost:5173`) —
   log in as an ADMIN account → **Moderation**: report a bot from the app first, then
   action it here (warn/suspend/ban) and confirm the banned bot drops out of Discover.

When a screen gets stale, hit **Reset** then **Full scene** again.

---

## Testing check-in away from a real store

The M18 check-in query is, in effect:
`ST_DWithin(store.geom, yourPoint, COALESCE(checkin_radius_meters, 250) + min(accuracy, cap))`
and the app sends your `lat/lng` from device GPS. So you can satisfy it at the **data**,
**GPS**, or **radius** layer. Pick one:

### Option A — Add your house as a store (most realistic; tests the real gate) ✅
1. Get your coordinates: in Google Maps, right-click your house → the first item is
   `lat, lng`. Copy it.
2. Append an entry to `apps/api/prisma/data/stores.json` (same shape as the others):
   ```json
   {
     "name": "Home Test",
     "address": "123 My St",
     "city": "MyTown",
     "state": "WA",
     "zip": "00000",
     "lat": 47.6062,
     "lng": -122.3321,
     "timezone": "America/Los_Angeles"
   }
   ```
3. Re-seed just the stores (idempotent upsert keyed on name+city, sets geom):
   ```bash
   pnpm --filter @manamap/api db:seed:stores
   ```
4. In the app, your real GPS at home is now inside the 250 m radius → check-in passes,
   and the M24 bots will populate "Home Test" when you run *Populate store* there.

### Option B — Fake the emulator's GPS to an existing store (fastest, no code) ✅
- **Android emulator**: `···` (Extended controls) → **Location** → enter a seeded
  store's `lat/lng` (e.g. Mox Boarding House `47.6665, -122.3756`) → **Set location**.
- **iOS simulator**: **Features → Location → Custom Location…** → enter the same.
- **Physical device**: use a location-spoofing dev app, or just go with Option A/C.
The real proximity flow now succeeds because the device reports store-adjacent coords.

### Option C — Widen or disable the radius for one store (pure bypass)
The query honors a per-store override column `checkin_radius_meters` (null → default 250).
Set it huge so any location passes:
```sql
-- psql / your DB client
UPDATE stores SET checkin_radius_meters = 1000000000 WHERE name = 'Card Kingdom';
```
(There's no JSON field for this — the seed doesn't map it — so SQL is the reliable path.)

### Option D — Null the geom (skip the check entirely for a test store)
Your code logs a warning and **skips proximity when `geom IS NULL`**:
```sql
UPDATE stores SET geom = NULL WHERE name = 'Home Test';
```
Now that store accepts a check-in from anywhere. Good for a dedicated "anywhere" test
store; just remember it's intentionally ungated.

> Prefer **A** or **B** for honest testing (they exercise the real gate). Use **C/D**
> only when you want to ignore location entirely. To verify the *rejection* path, set
> the emulator far away and confirm you get the `422 { code: 'too_far', distanceMeters,
> allowedMeters }` "move closer" sheet.

---

## Two-device alternative (no Dev panel needed)

You can also simulate a second human without M24 at all: run a second emulator (or the
web build), `dev-login` as `marchesa@example.com`, and drive both sides by hand — useful
for watching both ends of a connection/pod/game in real time. M24 is the faster
single-device path; this is the "see both perspectives" path.

---

## Gotchas

- **Bots not appearing?** You're probably not checked in, or checked in at a different
  store than the harness used. Check in first; `populate-store` defaults to your active
  venue.
- **LFG/pod vanished?** They're TTL'd in Redis (by design). Re-run the scenario.
- **Nothing in prod build:** if `NODE_ENV=production`, `/api/v1/dev/*` returns 404 and
  the Dev panel is hidden — that's correct.
