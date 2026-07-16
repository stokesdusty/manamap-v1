# manamap — Production Readiness Backlog

Action items from the 2026-07-15 production readiness audit (reliability/observability,
testing/CI, infra/data integrity, legal/compliance). Each item has a self-contained prompt
— hand it directly to a coding agent or paste it into a new session. Strike items through
or delete when shipped, same convention as `BACKLOG.md`.

Items already solid and requiring no action (Sentry, structured logging, env validation,
CI lint/typecheck/test, recent migration safety, location consent, push-token/presence
cleanup on account deletion) are omitted — see the audit artifact for the full picture.

---

## 🔴 Critical — blocking real user data

- [x] **Database backup strategy.** Tracked in `BACKLOG.md` Phase 4 ("Database backups") — Supabase Free tier does not auto-backup. Implemented via a daily GitHub Actions workflow (`.github/workflows/db-backup.yml` + `scripts/backup-db.sh`): `pg_dump` against Supabase's Session pooler connection string, uploaded to Cloudflare R2 (free tier), 7-day retention. See `BACKLOG.md`'s Phase 4 entry for the one-time setup steps and restore procedure.

---

## 🟠 High priority

- [ ] **Health check can't see a dead database.** `apps/api/src/health/health.controller.ts:5-8` returns a hardcoded `{status:'ok'}` with no DB/Redis check, so an orchestrator keeps routing traffic to a broken instance.

  > **Prompt:** "In `apps/api/src/health/`, add a readiness check alongside the existing liveness `/health` endpoint. It should run `prisma.$queryRaw\`SELECT 1\`` and a Redis `PING` (via the existing Redis client used by presence/throttle), returning 200 only if both succeed and 503 with the specific failing dependency otherwise. Keep the existing `/health` route as pure liveness (always 200) so container restarts aren't triggered by a transient DB blip — expose the new check at `/health/ready`. Update any Railway/deploy health-check config to point at the new route if appropriate."

- [ ] **BullMQ jobs fail silently, once, forever.** Neither the `gamification` nor `event-reminders` queue configures `attempts`/`backoff` (`apps/api/src/gamification/gamification.module.ts:10-18`, `apps/api/src/event-reminders/event-reminders.service.ts:52-63`), and there's no failed-job listener.

  > **Prompt:** "Add retry resilience to both BullMQ queues in `apps/api/src/gamification/` and `apps/api/src/event-reminders/`. Set `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }` on both `BullModule.registerQueue(...)` configs, preserving existing `removeOnComplete`/`removeOnFail` options (add `removeOnFail: { count: 1000 }` where missing so failed jobs don't accumulate unbounded in Redis). Then add an `OnQueueFailed`/`QueueEventsListener` (or a `QueueEvents` instance) per queue that logs the failure via the existing pino logger and captures it to Sentry with the queue name and jobId. Don't change job payload shapes or existing jobId patterns (`${eventId}:${userId}:morning|hour` must stay idempotent)."

- [ ] **Life Tracker breaks across multiple API instances.** `apps/api/src/ws-adapter.ts:12-21` runs Socket.IO fully in-memory — no Redis adapter — so a broadcast on one instance never reaches a room member connected to another.

  > **Prompt:** "Add `@socket.io/redis-adapter` to `apps/api/src/ws-adapter.ts` so Socket.IO broadcasts (used by the life-tracker gateway) work across multiple API instances. Use the existing `REDIS_URL` env var to create pub/sub Redis clients (ioredis, matching whatever client library the rest of the app already uses for Redis), call `createAdapter(pubClient, subClient)`, and set it via `server.adapter(...)` in `createIOServer`. Confirm the existing single-instance dev setup still works unchanged (adapter should be a no-op risk-wise with one instance), and note in `CLAUDE.md`'s 'known gotchas' that this is now handled so the note about the ignored `port: 3001` config doesn't get read as still-current advice about scaling limitations."

- [ ] **Missing indexes on hot-path tables.** `Encounter` (schema.prisma:444) has zero indexes despite backing Discovery/History/Rivalries; `GamePlayer` (623) has no standalone index on `userId`; `Report` (582) has no index on `status`; `stores.geom` has no GIST spatial index.

  > **Prompt:** "Add a Prisma migration that adds indexes for these known hot-path queries in `apps/api/prisma/schema.prisma`: (1) `@@index([userId])` and `@@index([opponentId])` and `@@index([storeId])` on `Encounter`; (2) `@@index([userId])` on `GamePlayer` (keep the existing `@@unique([gameLogId, userId])`); (3) `@@index([status])` on `Report`; (4) a raw-SQL migration (Prisma doesn't model GIST indexes natively) adding `CREATE INDEX IF NOT EXISTS stores_geom_idx ON stores USING GIST (geom);` — add this as a `.sql` migration file following the existing pattern of hand-written PostGIS migrations in `apps/api/prisma/migrations/`. Run `pnpm --filter @manamap/api db:migrate` to generate and apply, then `prisma generate`. Verify with `EXPLAIN ANALYZE` on the nearby-stores query that it now uses the index."

- [ ] **7 API modules have zero test coverage.** `encounters`, `admin-users`, `admin-stores`, `life-tracker`, `play-online`, `socials`, `notifications` have no unit or e2e tests.

  > **Prompt:** "Add unit test coverage for the two highest-blast-radius untested modules first: `apps/api/src/admin-users/` and `apps/api/src/admin-stores/`. Follow the existing test conventions in `apps/api/src/admin-moderation/__tests__/` (same domain, already covered) for mocking Prisma and asserting ADMIN-only access. Cover: role-guard enforcement, the self-lockout protections (`AdminUsersService.updateProfile` and `takeModerationAction` blocking an admin from acting on themselves), and the search/list/detail endpoints. Do `life-tracker` next — add a Socket.IO integration test (see if `apps/api/test/` e2e-spec conventions have a websocket test client already, e.g. `socket.io-client` in devDependencies) covering `join_tracker` auth rejection and a basic `start_tracker` → `life_delta` round trip."

- [ ] **apps/admin and apps/mobile have no tests at all.** No Vitest/Jest/RTL config in either app.

  > **Prompt:** "Set up a minimal test harness in `apps/admin` (Vitest + React Testing Library, matching the Vite setup already there) and write component tests for the two highest-risk flows: the offer-code redemption screen (`/stores/:storeId/redeem`) and the broadcast send form (3/24h cap enforcement, audience selection). Don't attempt full E2E/Cypress yet — component-level tests covering the redeem/broadcast logic are the priority given they're the flows with real financial/reputational consequence if they silently break."

- [ ] **Legal docs ship with unresolved bracket placeholders.** `packages/shared/src/legal.ts:135` reads `"at least [13 / the age of digital consent in your jurisdiction]"`; `legal.ts:205` has `"[jurisdiction to be specified]"`.

  > **Prompt:** "This one needs a business/legal decision before it's an engineering task — flag to the team: what's the actual minimum age (13 with parental consent under COPPA, or a flat 16/18?) and what jurisdiction's law governs the ToS? Once decided, update `packages/shared/src/legal.ts:135` and `:205` with the final text (no brackets). Since both `apps/admin`'s `/terms` `/privacy` pages and `apps/mobile`'s `LegalDocumentScreen.tsx` render this shared content, no other code changes are needed — just the copy."

- [ ] **No age gate anywhere in the product.** No DOB field in the schema; `OnboardingScreen.tsx` collects no age input.

  > **Prompt:** "Add an age-gate step to `apps/mobile/src/screens/OnboardingScreen.tsx`. Depends on the minimum-age decision from the legal-docs item above — implement as either a birthdate picker (compute age, block onboarding completion below the minimum) or a simpler '18+' / 'I am at least [age]' attestation checkbox if a birthdate field is overkill for the decided policy. Add the corresponding field to `User` in `schema.prisma` (nullable `birthdate DateTime?` or `ageAttestedAt DateTime?`) via a migration, and to `OnboardingSubmitSchema` in `packages/shared/src/index.ts`. Enforce server-side in `MeService`'s onboarding-submit handler, not just client-side."

- [ ] **Account deletion doesn't clean up active Pods.** `apps/api/src/me/me.service.ts:545-609` calls `presence.checkout()` and `lfg.remove()` but never touches `PodsService` — a deleted user can linger in `pod:${podId}` until the 90-minute TTL.

  > **Prompt:** "In `apps/api/src/me/me.service.ts`'s `deleteAccount` method, add cleanup of any Pod the user belongs to, mirroring the existing `presence.checkout()`/`lfg.remove()` calls right above it. Inject `PodsService` (check how `DevModule` already imports it as a precedent for cross-module service exports) and call whatever internal method corresponds to a member leaving or a host disbanding — reuse the existing `/v1/pods/:id/decline` or disband logic rather than duplicating Redis key manipulation. Confirm the fix with a test: create a pod, join as a second user, delete that second user's account, and assert they no longer appear in `GET /v1/pods/:id`."

---

## 🟡 Medium priority

- [ ] **Redis has no memory/persistence policy set.** `docker-compose.yml:18-28` — no `maxmemory-policy`, no explicit `appendonly` config. LFG/Pods/life-tracker state and rate-limit counters live only in Redis.

  > **Prompt:** "Add `--maxmemory-policy noeviction --appendonly yes` to the Redis service command in `docker-compose.yml` (or the equivalent config in whatever manages production Redis, e.g. Railway Redis settings) so writes fail loudly (`OOM command not allowed`) instead of silently evicting active game state. Document the production requirement in `CLAUDE.md`'s Infrastructure section. If Railway Redis doesn't expose these settings directly, note that as a constraint and document a memory-usage alert instead."

- [ ] **No graceful shutdown on deploy.** No `app.enableShutdownHooks()` or `SIGTERM` handler in `apps/api/src/main.ts` — only `uncaughtException`/`unhandledRejection` are hooked.

  > **Prompt:** "In `apps/api/src/main.ts`, call `app.enableShutdownHooks()` after `NestFactory.create(...)` so `onModuleDestroy` lifecycle hooks (`PrismaService`, `AnalyticsService`) run on shutdown. Add an explicit `process.on('SIGTERM', async () => { await app.close(); process.exit(0); })` handler alongside the existing `uncaughtException`/`unhandledRejection` handlers. Verify locally that `docker stop` / Ctrl+C on the dev server logs a clean shutdown sequence rather than an abrupt exit."

- [ ] **Push delivery failures are invisible.** `apps/api/src/notifications/notifications.service.ts:60-67` swallows push-send errors entirely — not logged, not in Sentry, no PostHog event.

  > **Prompt:** "In `apps/api/src/notifications/notifications.service.ts`, update the try/catch around push sends (~line 60-67) to log the caught error at `warn` level via the existing pino logger (include the affected userId/pushToken count, not the token itself) and emit a PostHog event like `push_delivery_failed` with the error type, following the existing `void this.analytics.capture(...)` fire-and-forget pattern used elsewhere in the codebase. Keep the failure non-fatal — the goal is visibility, not turning this into a hard failure."

- [ ] **No pre-commit enforcement.** No husky/lint-staged anywhere in the repo.

  > **Prompt:** "Add husky + lint-staged to the repo root. Configure a pre-commit hook that runs `lint-staged` scoped to staged files only: eslint --fix and prettier for `.ts`/`.tsx` files across all three apps and `packages/shared`. Keep it fast — no full typecheck or test run in the hook (that stays CI's job). Add the setup instructions to the root README or `CLAUDE.md` pnpm workspace notes section."

- [ ] **No full-stack local/staging environment.** `docker-compose.yml` only runs Postgres+Redis — no compose service for the API or admin app.

  > **Prompt:** "Extend `docker-compose.yml` with an `api` service that builds from a new `apps/api/Dockerfile` (multi-stage: pnpm install + prisma generate + build, then a slim runtime stage), depends on `postgres`/`redis` with healthcheck conditions, and reads its env from a `.env` file matching `apps/api/.env.example`. Don't containerize `apps/mobile` (Expo dev workflow doesn't fit compose) or `apps/admin` unless there's a specific need — Vite's dev server is fine running natively. This also produces the Dockerfile needed for the 'no deployment artifact in-repo' gap even if Railway's buildpack deploy continues to be used in production."

- [ ] **Every deploy is atomic with no rollback tooling.** No feature-flag library, no canary/blue-green, no CD workflow in `.github/workflows`.

  > **Prompt:** "This is a process decision more than a single code change — propose it to the team rather than implementing unilaterally. At minimum, add a documented rollback procedure (Railway keeps previous deploy images; document the exact steps to redeploy the prior version) to `BACKLOG.md` or a new `docs/deploys.md`. If feature flags are wanted for riskier changes going forward, a lightweight approach (an env-var-driven flag checked in the relevant service, no new dependency) is proportionate to this app's current scale — don't reach for a full flag platform yet."

- [ ] **No migration drift detection in CI.** CI proves migrations apply via `prisma migrate deploy` in `apps/api/test/global-setup.js`, but nothing checks `schema.prisma` hasn't drifted from migration history.

  > **Prompt:** "Add a step to `.github/workflows/ci.yml` (or `e2e.yml`, wherever the ephemeral Postgres is already spun up) that runs `pnpm --filter @manamap/api exec prisma migrate diff --from-migrations apps/api/prisma/migrations --to-schema-datamodel apps/api/prisma/schema.prisma --exit-code` (or `prisma migrate status`) and fails the job if there's drift. Place it right after migrations are applied in the existing e2e setup."

- [ ] **Report/ModerationAction/RefreshToken grow unbounded.** No cleanup, cron, or TTL for any of the three.

  > **Prompt:** "This needs a retention-policy decision, not just code — propose reasonable defaults to the team: e.g. expired/revoked `RefreshToken` rows older than 30 days, resolved `Report` rows older than 1 year (check if there's a legal/dispute-window reason to keep longer), `ModerationAction` rows kept indefinitely as an audit log (don't purge these — they're the accountability record). Once agreed, add a scheduled cleanup job (a new BullMQ repeatable job, or a scheduled script) that only touches `RefreshToken` and `Report` per policy."

- [ ] **Secrets are flat `.env` files with no documented production secrets-management approach.** ~19 env vars across two `.env.example` templates.

  > **Prompt:** "Confirm with the team whether Railway's built-in environment variable storage (already used per `BACKLOG.md` Phase 1) is considered sufficient secrets management for current scale, or whether a dedicated secrets manager is wanted. If Railway's variables are sufficient, just document that decision explicitly in `CLAUDE.md`'s Infrastructure section so it doesn't read as an unaddressed gap. No code change needed unless the team decides otherwise."

- [ ] **No in-person meetup safety messaging.** No screen surfaces "meet in public" guidance despite the app's core loop being real-time location + stranger-matching.

  > **Prompt:** "Add a brief, non-intrusive safety note the first time a user joins an LFG session or requests/joins a Pod — something like 'Meeting up? Play in the store's common area and let a friend know where you'll be.' A one-time dismissible banner in `apps/mobile/src/screens/StoresScreen.tsx` (LFG join) and `PodScreen.tsx` (pod join), gated by a flag in local storage so it only shows once per user, is enough — this doesn't need a new onboarding step or schema change."

- [ ] **Terms acceptance isn't an auditable clickwrap.** `apps/mobile/src/screens/SignInScreen.tsx:253-271` shows disclosure text only — no checkbox, no server-side record of if/when a user agreed.

  > **Prompt:** "Add a `termsAcceptedAt DateTime?` and `termsVersion String?` field to `User` in `apps/api/prisma/schema.prisma` via a migration. In `apps/mobile/src/screens/SignInScreen.tsx`, keep the existing disclosure text but have first-time sign-in record acceptance server-side — the auth endpoints (`POST /v1/auth/discord|apple|google`) already run `upsertUserByEmail` on first-ever sign-in per `CLAUDE.md`; set `termsAcceptedAt`/`termsVersion` there on user creation. Don't require an extra explicit checkbox tap unless legal specifically wants opt-in friction — recording timestamp-of-first-login against a versioned ToS is a reasonable middle ground for a low-risk-category app like this."

- [ ] **No report/block affordance for existing connections.** `apps/mobile/src/screens/ConnectedRevealScreen.tsx` has no report/block entry point, unlike `PlayerPreviewScreen.tsx` which already has one.

  > **Prompt:** "Add the same report/block UI already built in `apps/mobile/src/screens/PlayerPreviewScreen.tsx` (lines ~191-497) to `apps/mobile/src/screens/ConnectedRevealScreen.tsx`. Reuse the existing `useSafety` hook rather than duplicating logic — this should be close to a copy-paste of the existing menu/action-sheet trigger plus the report-reason modal, wired to the connection's `userId`."

- [ ] **No report path for store-generated content.** `Report`/`ReportReasonSchema` only target users — no way to flag an abusive broadcast or bad store suggestion.

  > **Prompt:** "Lower priority — only pick this up once broadcast/store-suggestion volume is high enough that manual admin review queues aren't keeping up. If/when needed: extend `ReportReasonSchema` and the `Report` model with an optional polymorphic target (`targetType: 'USER' | 'BROADCAST' | 'STORE_SUGGESTION'`, `targetId`) instead of the current implicit user-only target, and add a report affordance to the broadcast view in `apps/mobile` and the store-suggestion flow."

---

## How we work an item

Same as `BACKLOG.md`: paste the prompt for the item into a fresh agent session (or this
one), let it implement + test, review the diff, then check the item off here.
