# manamap

pnpm + Turborepo monorepo.

## Workspaces

| Package | Description |
|---------|-------------|
| `apps/mobile` | Mobile app (not yet scaffolded) |
| `apps/api` | API server (not yet scaffolded) |
| `packages/shared` | Shared Zod schemas + inferred TypeScript types |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9 — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file
cp .env.example .env

# 3. Start backing services (Postgres 16 + PostGIS, Redis 7)
docker compose up -d

# 4. Verify services are healthy
docker compose ps
```

## Development

```bash
pnpm dev          # run all dev scripts in parallel
pnpm typecheck    # type-check all workspaces (builds shared first)
pnpm lint         # ESLint across all workspaces
pnpm build        # compile all packages
pnpm format       # Prettier across the repo
```

### Filtering to a single workspace

```bash
pnpm --filter @manamap/api typecheck
pnpm --filter @manamap/shared build
```

## Services

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL (PostGIS) | `localhost:5432` | see `.env` |
| Redis | `localhost:6379` | — |

The PostGIS extension is automatically enabled by the `postgis/postgis` image.

## Packages

### `@manamap/shared`

Exports Zod schemas and their inferred TypeScript types. Both apps declare a
`workspace:*` dependency on this package so they share a single source of truth.

```ts
import { UserSchema, PlaceSchema } from '@manamap/shared';
import type { User, Place, Coordinates } from '@manamap/shared';
```

## Store seed data

Launch store data lives in `apps/api/prisma/data/stores.json` — a curated list of real MTG local game stores across the Seattle and Portland metros.

### JSON record format

```json
{
  "name": "Guardian Games",
  "address": "345 SE Taylor St",
  "city": "Portland",
  "state": "OR",
  "zip": "97214",
  "lat": 45.5167,
  "lng": -122.6602,
  "timezone": "America/Los_Angeles",
  "website": "https://www.ggportland.com",
  "discordUrl": "https://discord.gg/example"
}
```

`timezone`, `website`, and `discordUrl` are optional. Use `America/Los_Angeles` for WA and OR stores.

### Idempotent seeding

Stores are upserted on the `(name, city)` compound unique key. Re-running the seed updates non-geo columns and refreshes coordinates — it never duplicates rows.

```bash
pnpm --filter @manamap/api db:seed          # full seed (formats, users, stores, badges)
pnpm --filter @manamap/api db:seed:stores   # stores only — prints "X created, Y updated"
```

### Adding a new city

1. Append store objects to `stores.json` with the correct `city`, `state`, and timezone.
2. Run `pnpm --filter @manamap/api db:seed:stores` — the script is safe to re-run.

## Tech stack

| Tool | Purpose |
|------|---------|
| [pnpm workspaces](https://pnpm.io/workspaces) | Monorepo package manager |
| [Turborepo](https://turbo.build/) | Task orchestration + caching |
| [TypeScript 5](https://www.typescriptlang.org/) | Strict mode throughout |
| [Zod](https://zod.dev/) | Runtime validation + type inference |
| [ESLint 8](https://eslint.org/) + [Prettier](https://prettier.io/) | Linting + formatting |
| [PostGIS 3 / Postgres 16](https://postgis.net/) | Geospatial database |
| [Redis 7](https://redis.io/) | Cache / pub-sub |
