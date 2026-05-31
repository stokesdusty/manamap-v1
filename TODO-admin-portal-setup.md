# Admin Portal — New Computer Setup

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15 + PostGIS extension running on localhost:5432
- Redis running on localhost:6379

---

## 1. Install dependencies

```
pnpm install
```

If you see `ERR_PNPM_IGNORED_BUILDS`, check `pnpm-workspace.yaml` — the failing package needs to be added under `allowBuilds: true`.

---

## 2. Set up the API environment

The file `apps/api/.env` should already exist with:

```
DATABASE_URL=postgresql://manamap:manamap@localhost:5432/manamap
REDIS_URL=redis://localhost:6379
API_PORT=3000
API_HOST=localhost
JWT_SECRET=dev-only-secret-do-not-use-in-production-replace-this-now
DISCORD_CLIENT_ID=1510362228526809199
DISCORD_CLIENT_SECRET=UpLXQym8AbfIKBLN796uRECvbdDxj4lt
DISCORD_REDIRECT_URI=manamap://auth/discord
```

Create the Postgres database and user if needed:
```sql
CREATE USER manamap WITH PASSWORD 'manamap';
CREATE DATABASE manamap OWNER manamap;
\c manamap
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## 3. Run migrations and seed

```
pnpm --filter @manamap/api db:migrate
pnpm --filter @manamap/api db:seed
```

The seed populates stores and default badges.

---

## 4. Set up the admin portal environment

Create `apps/admin/.env.local`:

```
VITE_DISCORD_CLIENT_ID=1510362228526809199
VITE_API_URL=http://localhost:3000/api
```

---

## 5. Add Discord redirect URI

In the Discord Developer Portal (discord.com/developers/applications):

1. Open application `1510362228526809199`
2. Go to OAuth2 → Redirects
3. Add: `http://localhost:5173/auth/callback`
4. Save changes

---

## 6. Start the API

```
pnpm --filter @manamap/api dev
```

API will be at `http://localhost:3000/api`

---

## 7. Start the admin portal

```
pnpm --filter @manamap/admin dev
```

Portal will be at `http://localhost:5173`

---

## 8. Use the portal

1. Go to `http://localhost:5173`
2. Click "Sign in with Discord"
3. After OAuth, you land on My Stores
4. Click "+ Claim Store" → search for a store → click Claim
5. Click into a store → Dashboard shows analytics + offers
6. Click "+ New Offer" → fill in title, type (First Visit or Streak), and save
7. The offer appears in the mobile app on that store's detail sheet

---

## Running everything together

Terminal 1 — API:
```
pnpm --filter @manamap/api dev
```

Terminal 2 — Admin portal:
```
pnpm --filter @manamap/admin dev
```

Terminal 3 — Mobile (optional, needs device/emulator):
```
pnpm --filter @manamap/mobile dev
```
