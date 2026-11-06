# Progress

## Done

### Phase 0
Scaffold (Next.js 16.4.5, TS strict, Tailwind 4), Nexconn SDK 26.2.1 verified against types (see PLAN.md), Neon via Vercel Marketplace, Vercel project linked to GitHub (auto-deploys), env vars in Vercel.

### Phase 1 (P0)
- **Timing engine** (`src/lib/timing/`): reveal math, one min-heap + single timer, NTP-style clock offset (median of 5, refreshed every 5 min and after reconnect), pause/resume, spoil me / reveal all, dedupe, ordering by match time. 23 unit tests.
- **Wire format** (`src/lib/transport/wire.ts`): text = `RC:TxtMsg` with `extra = {"sb":1,"lag":ms,"n","a"}`; custom `SB:Roar|Lag|Anchor|SyncCheck|SyncTap`, all zod-validated. Malformed text stamp = normal unlocked message.
- **Transports:** Nexconn (dynamic import, initialize/connect once, 250 ms send spacing for the 5 msg/s limit) and a local BroadcastChannel demo (`/r/ANY?demo=1&lag=20`, dev builds only, red DEMO MODE banner).
- **Server:** signed Server API client with backup-domain failover; `/api/session` (guest + token + join, rate-limited, profanity filter), `/api/rooms`, `/api/time`, `/api/metrics`, `/api/feedback`, `/api/client-error`, `/api/privacy/delete`.
- **Rooms:** 6-char codes, invite link with `?ref=`, QR, share/copy; overflow to "<name> · Stand B" at 300 members (also on Nexconn error 25411).
- **UI:** landing (hero animation, how it works, my rooms, create form), join form, room (lag badge, lag sheet with presets/slider/±1/nudges, locked bubbles with countdown ring, spoil-me confirm, reveal all, empty state, connection banner, send retry), feedback prompt after 20 min, privacy page with delete, stats page, error boundary, 404.
- **Spoiler-leak rules:** locked bubbles receive no content (tested), no previews in My rooms, tab title counts only, aria-live announces revealed messages only, OG images never include messages.
- **PWA:** manifest, generated icons (64/180/192/512), theme color, standalone.
- **Metrics:** batched beacons; test/bot users flagged (`?test=1` marks a browser as tester) and excluded from `/stats`.
- **CI:** typecheck, lint, tests on every push.

### Verified live (dev server + real Nexconn, test users)
Session/token/join, room create, rejoin, bad name 400, unknown room 404; browser SDK connects; server-sent message from a faster feed arrived locked ("unlocks in 17s"), content absent from the DOM, tab title "(1 locked)", revealed on schedule; message sent from the browser carried its lag stamp through Nexconn (locked for a slower viewer); history reload; SB:Lag send; metrics rows flagged test.

### Phase 2 (P1), Nov 6
- **Quick-chat chips** per sport (`QUICK_CHIPS` in `config.ts`); normal lag-stamped text, weigh extra in Hype.
- **Hype Radar** (`timing/hype.ts`, tested): heat from locked messages revealing in the next 45 s; distinct senders weigh most. Heartbeat strip above the input, "👀 something's coming in Ns", vibration, Suspense toggle in the room menu. The store hands the UI numbers only, never locked content.
- **Stadium Roar**: hold-to-roar button (SB:Roar every 1.5 s, intensity grows with hold), procedural Web Audio crowd (`audio/crowd.ts`) plays when roars reveal for *me*, floodlight glow, "Tap to turn on stadium sound", sound toggle. Old roars (history) stay silent.
- **Judge Mode** (`/try`): one tap creates a private room with bots Arjun 📺 and Meera 🏟️ (real Nexconn users, `is_bot`). "Start the over" posts a First ball SB:Anchor from a bot; the mock scoreboard plays at the visitor's own lag; `/api/try/step` sends each scripted bot message once (atomic bitmask), never early. Coach marks, held-back summary, second window on the TV feed (flagged test). Try rooms (`kind='try'`) are left out of the /stats room count.
- **Lag Leaderboard + watching now**: badges relative to the fastest member; full list sheet. Each client announces its lag once per connection. "Watching now" = `/api/presence` heartbeat (Nexconn has no channel presence).
- **Sync Check** (`timing/sync-solver.ts`, tested): tap NOW at a named moment; first tap per person, outliers >180 s from the median dropped; "Apply new lag: N s?"; never silent.
- **Scheduled + featured rooms, admin**: optional start time, countdown, Google Calendar / .ics; featured list on the landing page; `/admin` (Bearer `ADMIN_TOKEN`) features rooms and posts anchors (SameBall host bot). Revealed anchors show as timeline dividers.
- **Safety**: report + block (block hides messages, hype and roars); room creator can mute 1 h or remove via the Server API; removed members can't rejoin.
- **Security fix (guest keys)**: guest ids are public (Nexconn sender ids, `?ref=` links) but were the only credential, so a room member could get a chat token as someone else or delete their data. The server now issues `key = HMAC(app secret, guestId)`; once a profile is keyed every sensitive call needs it. Pre-key guests get a key on their next visit.
- **Webhook metrics**: `/api/nexconn/webhook` verifies the signature, rejects timestamps >5 min old (the signature doesn't cover the body), stores group-channel messages deduped by message id. `/stats` uses these counts once rows exist, plus median lag spread per room and a 14-day daily-active chart.
- Migrations 0001–0004 applied to Neon (all additive).

### Verified live in Phase 2 (dev server + real Nexconn, test users)
Judge Mode API (create, join, start idempotent, steps once/early 425/non-member 403, bot text + bot roar accepted by Nexconn); presence; admin (401 without token, feature on/off, anchor posted, try rooms 404, start-time bounds); guest keys (reuse without/with wrong key 401, legacy guest upgraded once); moderation (non-owner 403, mute and remove accepted by Nexconn, removed member gets 403 on rejoin); report; webhook (signed 204, retry deduped, bad/stale signature 401).
**Not verified in a browser** (the Chrome extension wasn't connected): the new room UI (chips, Hype strip, roar button and audio, Judge Mode panel, leaderboard, Sync Check card, start banner). Needs the phone checklist.

### Phase 3 (P2), Nov 6
- **Ghost Crowd (replay)**, behind `NEXT_PUBLIC_FEATURE_GHOST_CROWD=1`. Room menu → "Watch with the crowd", or link `/r/CODE?replay=1`. Everything starts locked; pick an anchor (or "Start of the chat" if the room has none) and tap Sync when your replay shows it: `lag = serverNow − anchor.matchTime`. Then pause/resume, −1m/−10s/+10s/+1m, a match clock ("First ball +12:34"), Re-sync. Chat and roars replay through the normal engine; messages you send carry your replay lag, so later viewers see them at the right moment. Loads up to 2,000 messages (20 pages).
  - Only locked bubbles due in the next 30 s are shown (none while paused or before sync); Hype strip hidden while paused.
  - Replays send no SB:Lag, skip presence, feedback, Sync Check and the leaderboard, and track no `message_locked`/`revealed_on_time`/`spoil_me`, so they never inflate "spoilers blocked". Only `replay_started`.
  - **Changed from the brief:** lag clamp raised from 6 h to 180 days (Nexconn keeps chat 180 days); otherwise a next-day replay (the Judges' room) is impossible. Lags above 6 h are left out of the Lag Leaderboard.
  - Tested: unit test for sync-to-anchor replay; typecheck, lint, build. **Not tried in a browser** (Chrome extension not connected).

## Next
- You: phone test of the P1 UI (checklist in chat), Nexconn Console settings below, then Phase 3 (P2).

## Console settings to switch on (you)
- Webhooks: URL `https://sameball.vercel.app/api/nexconn/webhook`, event "message send" (leave "Include Server API Messaging" off so bots stay out).
- Profanity filter for chat messages.
- Group Channels → "Enable pre-join history access by new member".

## Known issues / notes
- An unknown room code shows the 404 page with HTTP 200 (streamed page). Cosmetic.
- Server-API messages don't appear in the *sender's own* history (no echo). Only affects bots, which never view chat.
- Clock offset is measured against our server; message times come from Nexconn's server. Both are NTP-synced, so the error should be tens of ms.
- Nexconn error `2007`: a dev-mode app caps registered users at 100. Each guest, bot and Judge Mode second window counts. Check your app's environment in the Console before inviting real users.
- The dev server sometimes keeps stale modules after edits (Turbopack on Windows); restart it if an API behaves like old code.
- Test rooms created during P1 checks (all by test users, excluded from /stats): 27299A (try), H5D4ZH, UA6F4H, VYQTGE, C7QAHC.
- Removed members still count toward `member_count` (overflow happens slightly early). Harmless at our scale.
