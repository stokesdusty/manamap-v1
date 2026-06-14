# manamap — Design Prompts for Remaining Screens

> Status: M19–M23 shipped. M24 dev-harness shipped. Home screen designed (app/screens-home.jsx).
> Below: the next design + build targets, ordered by user-facing impact.

---

## M35 · Stores screen

**What it is:** Full-screen map + list view of LGS locations. The entry point for check-in,
event RSVP, leaderboard, and reward redemption.

**Reference:** `apps/mobile/src/screens/StoresScreen.tsx` (2 000 lines — full implementation).
Components: `BadgeEarnedSheet`, `StoreSuggestSheet`. Hooks: `useStorePins`, `useStoreDetail`,
`useStoreEvents`, `useLeaderboard`, `useStoreOffers`, `useCheckin`, `useAttendEvent`,
`useUnattendEvent`, `useEventAttendance`, `useNearby`, `useConfirmStore`, `useClaimOffer`.

**Screens / states to design:**

1. **Map view** — store pins (confirmed = accent colour, proposed = grey), active-store ring,
   search bar always visible, map/list toggle top-right, "Suggest a store" FAB.
2. **List view** — text-search results; distance, city, active-store highlight.
3. **StoreDetailSheet (bottom sheet)**
   - Header: store name, address row, Discord link row (opens URL).
   - Proposed badge + confirmation progress bar (N/3) + "Confirm this is real" CTA.
   - Active-store badge ("You're checked in here").
   - **Tabs:** Schedule | Leaderboard.
   - **Schedule tab:** events grouped by date label (Today / Tomorrow / weekday).
     EventRow: source-colour dot, name, time, format chip, attendee count,
     here-now count, RSVP button (Going? → Going! toggle), expand chevron →
     attendee list (Here now + RSVP'd sections, each with avatar + name + here-badge).
   - **Leaderboard tab:** ranked rows (rank, avatar, name, streak, total visits),
     user's own rank pinned at bottom if outside displayed list.
   - **Who's here now** (only when user is checked in at this store): player list with Met badge.
4. **Check-in button states:** default → acquiring location (spinner) → too-far error
   (distance delta + retry) → permission denied (link to Settings) → location error →
   success ("Checked in! Discover is now active.").
5. **Event tag prompt** (modal after check-in when active events exist): "Here for an event?"
   list of active events → tap to associate check-in.
6. **Reward modal** (first-visit / streak offer triggered post-check-in): offer title +
   description + "Redeem at counter" → claim code display (large code text + QR) →
   polling for staff redemption → "Redeemed!" confirmation.
7. **BadgeEarnedSheet:** full-screen celebration when a badge is unlocked at check-in.
8. **StoreSuggestSheet:** name + address fields, submit.

**UX notes:**
- Stores tab entry: add to Tab bar between Home and Nearby, or surface from Home
  quick-action "Find a store". Decide in design review.
- Proposed stores require 3 independent confirmations to go live.
- Active store persists in `ActiveStoreContext`; discovery, LFG, and nearby are gated on it.
- Check-in has a GPS distance gate; in `__DEV__` it falls back to store coords.

---

## M36 · History / Encounters screen

**What it is:** Chronological, deduplicated list of every player the user has crossed paths with
(presence detection, connections, games). Tapping navigates to PlayerPreview.

**Reference:** `apps/mobile/src/screens/HistoryScreen.tsx`.
Hook: `useEncounters` → `{ encounters: EncounterItem[], crossedPathsCount }`.
`EncounterItem`: `{ peer: { id, displayName, avatarColors, commander }, source: 'PRESENCE' | 'CONNECTION' | 'GAME', storeName, createdAt }`.

**Screens / states:**

1. **History list** — sections: Today / This week / Earlier (sticky headers).
2. **EncounterCard:** avatar, name, source badge (icon + label + per-source colour:
   PRESENCE = accent, CONNECTION = green, GAME = purple), store name, relative timestamp,
   commander sub-line.
3. **Crossed-paths nudge** (conditional, top of list): "You've crossed paths with N players
   you haven't connected with yet" → calls to action toward Nearby.
4. **Empty state:** first-visit illustration + message.

**UX notes:**
- Deduplicated per peer: one card per person, most-recent encounter timestamp shown.
- Entry point: tappable row in You screen profile section or Home history link.
- Present as a modal sheet (`presentation: 'modal'`), not a tab.

---

## M37 · Life Tracker

**What it is:** Full-screen, real-time multiplayer life tracker (1–4 players) synced over
WebSocket. Launched from inside a Pod screen via "Start Life Tracker".

**Reference:** `apps/mobile/src/screens/LifeTrackerScreen.tsx` (930 lines).
Hook: `useLifeTracker(podId)` — WebSocket over Socket.IO at `/life-tracker`.
State type: `TrackerState` with `players: TrackerPlayer[]`, `activePlayerId`,
`monarchId`, `initiativeId`, `turnNumber`. Tracker counter type: `'poison' | 'energy' | 'experience'`.

**Screens / states:**

1. **SetupSheet** (pre-start): life total presets (20 / 40) + custom field, Start button.
   Non-hosts see "Waiting for host…" spinner.
2. **2-player portrait:** opponent rotated 180° on top, self on bottom. Large life total (80pt).
3. **2-player landscape:** opponent rotated left, self right.
4. **3-player portrait:** two opponents side-by-side top, self full-width bottom.
5. **4-player 2×2 grid:** all panels compact (56pt life total).
6. **PlayerPanel per player:**
   - Header: colour dot, name, commander cast count badge (×N if cast > 0).
   - Life total (large, `adjustsFontSizeToFit`), −5 / −1 / +1 / +5 tap zones (long-press repeats at 120ms).
   - Counter row: poison ☠ / energy ⚡ / experience ✦ — inline ±1 taps; hide energy/experience if 0 (compact).
   - Commander damage row (shows after first cmd damage): total + per-source chips, tap to open CommanderDamageSheet.
   - Eliminated overlay: greyed out + "OUT" label, X becomes refresh icon to restore.
7. **CommanderDamageSheet (modal):** per-source rows with colour dot, damage total (red at 18+), ±1 stepper.
8. **GameBar (top strip):** close, turn chip (T1…), active-player chip (coloured), monarch 👑 chip,
   initiative ⚔️ chip, undo (disabled when no history), next-turn, reset.

**UX notes:**
- Panels fill available screen, no scroll. Use `useWindowDimensions` for landscape detection.
- Long-press repeat: `setInterval` at 120ms, `delayLongPress: 400ms`, cancel on `onPressOut`.
- Reset requires confirmation alert (destructive action).
- Real-time sync: life delta has optimistic update locally, server broadcasts to pod.

---

## M38 · Play Online sheet

**What it is:** Modal for sending SpellTable or Convoke room invites to connections via push
notification. Surface from: You profile "Play Online" action; Pod screen action menu.

**Reference:** `apps/mobile/src/components/PlayOnlineSheet.tsx`.
Hook: `usePlayOnlineInvite` — sends `{ platform: 'spelltable' | 'convoke', roomLink, connectionIds }`.
On success: `{ sent: number }`.

**Screens / states:**

1. **Platform picker:** SpellTable | Convoke — segmented buttons with icon + label.
2. **Room link input:** placeholder adapts to platform (`https://spelltable.wizards.com/room/...`
   vs `Room name or invite link`).
3. **Connection picker:** scrollable list with avatar, name, checkbox. Multi-select.
   Empty state: "Connect with other players to invite them to your game."
4. **Send button (sticky footer):** label adapts to selection count ("Send to 3 players"),
   disabled until link + ≥ 1 selection.
5. **Success:** native Alert — "N players will receive a notification with your room link." Resets form.

**UX notes:**
- `presentationStyle: 'pageSheet'` (not full-screen).
- Form resets `onShow` so re-opening starts clean.
- No room creation — user supplies their own room link or name.
- Only accepted connections (not pending) appear in picker.

---

## M39 · App walkthrough (first-login tour)

**SHIPPED** — see `app/walkthrough.jsx`.

5-step spotlight tour triggered automatically after onboarding completes.
Steps: Home hub → Open to Play tile → Nearby tab → Scan button → Connect tab.
Stores completion in `localStorage` key `mm_wt2_done`. Replay via Tweaks → set Start to Onboarding.
