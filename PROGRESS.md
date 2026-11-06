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

## Next
- Two-phone test checklist (you), then Phase 2 (P1).

## Known issues / notes
- An unknown room code shows the 404 page with HTTP 200 (streamed page). Cosmetic.
- Server-API messages don't appear in the *sender's own* history (no echo). Only affects bots, which never view chat.
- Clock offset is measured against our server; message times come from Nexconn's server. Both are NTP-synced, so the error should be tens of ms. Could refine later using own-message send round trips.
- "Try it in 30 seconds" button is hidden until Judge Mode (P1) exists.
- `/stats` shows totals only; the daily-active chart and median lag spread come with P1 webhooks.
- Nexconn error `2007`: a dev-mode app caps registered users at 100. Check your app's environment in the Console before inviting real users.
