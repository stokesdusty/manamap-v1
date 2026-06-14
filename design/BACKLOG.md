# manamap — Backlog

Living backlog of candidate features beyond the shipped roadmap (Phase 0–3) and
hardening set (M14–M18, all merged). Ordered roughly by leverage. Keep this file
in the repo root so it travels with the code and the coding agent can read it as
context. Move items into a milestone prompt when you pick them up; strike them
through or delete when shipped.

> Status as of this writing: Phases 1–3 + M14 (safety) · M15 (seeding) ·
> M16 (onboarding) · M17 (dark theme) · M18 (proximity check-in) are **shipped**.
> M19 (moderation), M20 (LFG), M22 (pods), M23 (log a game) are **designed + build-prompt-ready** (hardening page).

---

## 🛡️ Trust & Safety
- [ ] **Moderation dashboard** (ADMIN-gated, admin portal) — action the `Report`
  rows currently written as `OPEN` with no review path. Queue + detail + actions
  (review / dismiss / warn / suspend / ban, with block). *In progress — see the
  moderation design + build prompt.*
- [~] **Rate limiting** — *Build prompt ready (M21 on the hardening page).* Cap
  connection requests, reports, and exchange-token mints per user/IP to stop spam
  and abuse (Redis sliding-window, @nestjs/throttler on the Fastify adapter).

## 🎲 The "play a game" loop  *(highest product upside)*
- [~] **LFG / "Open to play now"** — *Designed (design/app/lfg.jsx) + build prompt ready
  (M20 on the hardening page).* A live, expiring status at your current store so
  players know you want a pod right now. Builds on the presence layer.
- [~] **Pod formation** — *Designed (design/app/pods.jsx) + build prompt ready
  (M22 on the hardening page).* Host-driven + join, target power ± tolerance,
  host-approves seats, "pod ready" with free-text meet spot. Builds on M20.
- [~] **Log a game** — *Designed (design/app/loggame.jsx) + build prompt ready
  (M23 on the hardening page).* Roster + decks + single winner → others confirm →
  pairwise WIN/LOSS Encounters feed profile stats, per-deck win rate, and a
  games-won leaderboard.
- [ ] **Player stats** — *Folded into M23* (W/L + per-deck win rate on the profile).
  Remaining: surface per-commander stats more richly / on the public card.

## 📅 Events
- [~] **RSVP reminders** — *Build prompt ready (M25).* Push the morning-of + ~1h
  before an event you've RSVP'd, via BullMQ delayed jobs; cancelled on un-RSVP.
- [~] **Event-day check-in tie-in** — *Build prompt ready (M26).* Link a check-in to
  an active event ("Here for Friday Commander?") + a live "who's here now" roster.

## 🏪 Store-owner value (admin portal)
- [~] **Broadcast announcement** — *Designed (design/store-tools.html) + build prompt
  ready (M27).* Push to checked-in / today / event-RSVP / recent-visitor audiences,
  with a daily cap + opt-out.
- [~] **Event management** — *Designed + build prompt ready (M28).* Owner CRUD over
  STORE-source events; Discord/Wizards events stay read-only.
- [~] **Staff redemption-verify** — *Designed + build prompt ready (M29).* Per-redemption
  one-time codes; staff enter/scan to validate + mark used.

## 🔁 Retention
- [~] **Notifications center / inbox** — *Designed (design/app/retention.jsx) + build
  prompt ready (M30).* Persist every push; header bell + grouped inbox that deep-links.
- [~] **Monthly quests** — *Designed + build prompt ready (M31).* Data-driven, month-scoped
  challenges with live progress; completion awards a badge.
- [~] **Friend-streaks** — *Designed + build prompt ready (M32).* Head-to-head rivalries
  aggregated from confirmed-game Encounters; surfaced on profile + connection detail.

## ⚙️ Platform & quality
- [~] **Simulated users / dev harness** — *Build prompt ready (M24).* DEV-only bot
  users acting through the real services + an in-app Dev panel; off in production.
- [x] **docker-compose** — DONE in repo (postgis:16 + redis:7 with healthchecks).
- [x] **Push delivery** — DONE: expo-server-sdk wired across connections, games, lfg,
  pods, broadcast, event-reminders. (M30 consolidates the duplicated sender.)
- [~] **E2E tests** — *Build prompt ready (M33).* Real-HTTP flows (auth→onboarding→
  check-in→connect→log-a-game) + safety gates; unit specs already exist.
- [~] **Observability** — *Build prompt ready (M34).* nestjs-pino structured logging +
  correlation IDs + global exception filter + optional Sentry.

---

### How we work an item
1. Design it in the prototype (`design/`) first when it has real UX — especially
   LFG, pod formation, moderation.
2. Turn the approved design into a grounded build prompt (reference real modules
   and file paths, state what's out of scope).
3. Build → review the PR → run acceptance checks → strike it off here.
