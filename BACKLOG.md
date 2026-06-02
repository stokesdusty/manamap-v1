# manamap — Backlog

Living backlog of candidate features beyond the shipped roadmap (Phase 0–3) and
hardening set (M14–M18, all merged). Ordered roughly by leverage. Keep this file
in the repo root so it travels with the code and the coding agent can read it as
context. Move items into a milestone prompt when you pick them up; strike them
through or delete when shipped.

> Status as of this writing: Phases 1–3 + M14 (safety) · M15 (seeding) ·
> M16 (onboarding) · M17 (dark theme) · M18 (proximity check-in) · M19 (moderation dashboard + enforcement) · M20 (LFG) · M21 (rate limiting) · M22 (pods) · M23 (log a game + player stats) are **shipped**.

---
MtG Artist Connection Logo
Social Post Review Queue
Manage imported posts from social platforms


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
- [ ] **Event management** — create/edit store events in the portal (today events
  are read-only / connector-sourced).
- [ ] **Staff redemption-verify** — a counter flow to validate/redeem the 8-char
  offer codes (enter or scan), marking them used.

## 🔁 Retention
- [ ] **Notifications center / inbox** — in-app history of connects, accepts,
  nearby pings, event reminders (push tokens already exist).
- [ ] **Monthly quests** — "meet 3 new players", "try a new store" — data-driven
  like badges.
- [ ] **Friend-streaks** — reward repeatedly playing the same people, not just
  visiting the same store.

## ⚙️ Platform & quality
- [ ] **docker-compose** in-repo for Postgres+PostGIS+Redis (CLAUDE.md notes none
  exists).
- [ ] **Push delivery** for the social loop (request / accept / nearby) via the
  existing Expo push tokens.
- [ ] **E2E tests** for the core flows (auth → onboarding → check-in → connect).
- [ ] **Observability** — structured logging + error tracking on the API.

---

### How we work an item
1. Design it in the prototype (`design/`) first when it has real UX — especially
   LFG, pod formation, moderation.
2. Turn the approved design into a grounded build prompt (reference real modules
   and file paths, state what's out of scope).
3. Build → review the PR → run acceptance checks → strike it off here.
