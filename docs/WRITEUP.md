# SameBall: the group chat that never spoils the match

**Nexconn Build Challenge 2026**

| | |
|---|---|
| Live app | https://sameball.vercel.app |
| Try it alone (30 s) | https://sameball.vercel.app/try |
| Source | https://github.com/Fushiguro6286/SameBall |
| Demo video | `<DEMO_VIDEO_URL>` |
| Nexconn App Key | `<APP_KEY>` |

<!-- FILL IN before exporting: every `<...>` placeholder. Use real numbers and quotes only. -->

## Why we built it

Every Indian cricket fan knows this one. You're watching the final over on a streaming app and your phone buzzes: "SIXXX 🔥🔥". Your screen is still showing the bowler walking back. The friend on cable TV is 30 seconds ahead of you, and the group chat just spoiled the best moment of the match.

So people mute the group during matches, which kills the fun of watching together. We wanted to keep the chat and lose the spoilers.

## The problem

The same match reaches people at different times:

- at the ground: live
- TV: a few seconds behind
- DTH: a little more
- streaming apps: 20 to 40 seconds behind
- radio: different again

In SameBall's own rooms the median gap between the fastest and the slowest screen in a room is `<N> s` (measured from the delay every message carries; see `/stats`, "Median lag spread per room").

Chat apps deliver every message as fast as possible, so the fastest feed sets the pace and everyone else gets spoiled. Speed is the bug.

## The solution

SameBall delivers each message **at the right moment** for each reader.

1. Each person tells SameBall how they're watching (TV, DTH, streaming app, web stream, radio, at the venue) and can fine-tune by the second.
2. Every message carries the sender's delay. SameBall works out which match moment it's about: `match time = sent time − sender's delay`.
3. On each screen the message stays locked until that moment reaches the screen: `reveal at = match time + my delay`. A locked bubble shows who sent it and a countdown, never the text.

On top of that core:

- **Hype Radar:** a heartbeat that pulses when friends are reacting to something you haven't seen yet. Suspense without spoilers.
- **Stadium Roar:** hold 📣 to roar; every phone plays the crowd at its own moment.
- **Call it:** a fair-play prediction game. Someone asks "Next ball?", everyone picks, and each person's picks close when the ball reaches *their own* screen. A friend on a fast feed can't cheat, a friend on a slow feed can't be spoiled, and the points leaderboard keeps the room playing all match. Only SameBall's per-screen timing makes this fair.
- **Lag Leaderboard** and **Sync Check:** see everyone's delay; calibrate the whole room from one shared moment.
- **Auto-sync from reactions:** when you react "SIX!" seconds after the fastest friend, again and again, SameBall works out how far behind your screen really is ("you're 31s behind the fastest screen, apply?") and nudges again if your stream drifts.
- **I paused / I'm back:** pausing your stream or sitting through an ad pauses the chat with you.
- **Squad recap:** when the match ends, each friend's recap opens as the end reaches their screen, with a story image and a "join this squad for the next match" link that brings new fans in.
- **The Wave:** after a big moment, watch it ripple across your squad's screens and share it as a story image.
- **Ghost Crowd replay:** watching the recording tomorrow? Sync to a moment and the room's chat and roars replay with your video.
- **"What did I miss?":** an AI summary of what your friends said, built only from messages already revealed on your screen.
- **Big public stadiums:** featured match rooms for up to 10,000 fans, split into stands.
- **Live score strip:** the score reaches each screen at that screen's delay, so the scoreboard never runs ahead of the TV.
- **Voice notes:** hold 🎙️ for up to 15 s; the note stays locked like text and plays when the moment reaches the listener.
- **Moment cards:** when a big moment has reached every screen, the squad's reactions in the order each person saw it, as a shareable card.
- **Creator rooms:** a host commentates for fans, with pinned messages, slow mode, "quiet the fans", remove for everyone, and only the host's predictions.
- **Series league:** Call it points across a whole series, a crown for the leader and a champion when a new series starts.
- **Couch mode:** "Same screen as Arjun" follows a friend's delay when you watch the same TV.
- **Gated Huddle:** opens only when every screen in the squad is within 5 seconds of the same moment.
- **Regional chips:** quick reactions in Tamil, Telugu, Bengali and Kannada (native script plus transliteration).
- **Hindi UI**, guest sign-in with no email or phone, report/block/mute, and a "Delete my data" button.

## Nexconn features used

| Feature | Nexconn API | Why |
|---|---|---|
| Match rooms, creator rooms | Group channels: Server API `/v4/group-channel/create`, `/join`, `/leave`; Web Chat SDK `GroupChannel` | Membership, moderation and 180-day history, which Ghost Crowd replays need |
| Guest sign-in | Server API `/v4/auth/access-token/issue`; SDK `NCEngine.connect` | No email or phone; one token per guest, minted server-side |
| Spoiler-free text | `RC:TxtMsg` with `extra` = sender's delay, name, avatar | Timing runs on Nexconn's server `sentTime`, so no client clock is trusted |
| Roars, delay stamps, Sync Check, match markers, Call it, host controls, live score | Custom message types (`registerCustomMessages`): `SB:Roar`, `SB:Lag`, `SB:SyncCheck`, `SB:SyncTap`, `SB:Anchor`, `SB:Call`, `SB:CallVote`, `SB:CallResult`, `SB:Host`, `SB:Score` | Structured events that persist in history and get the same per-screen hold as chat |
| Voice notes | HD voice messages (`RC:HQVCMsg`) via `sendMediaMessage`; Nexconn file storage | Upload and playback without our own storage; the `extra` delay stamp makes them lock like text |
| Late joiners, replay, catch-up, series league | Message history (`createMessagesQuery`) | Anything still ahead of the reader comes back locked; league points are rebuilt from history, nothing extra stored |
| Judge Mode bots, match markers, score updates | Server API `/v4/group-channel/message/send` as bot users | Bots send exactly what real clients send, so the same code holds them |
| Creator moderation | Server API mute list, `/v4/message/delete` (recall), `/v4/group-channel/freeze-list/add` + `allowed-sender-list/add` ("quiet the fans") | Enforced by Nexconn, not just hidden in our UI (a frozen fan's send is rejected with 22408) |
| Big public stadiums | Community channels (`/v4/community-channel/create`, `/join`, `/message/send`) with public sub-channels as stands | 10,000 members, split so each stand's chat stays readable |
| Reconnect banner | `ConnectionStatusHandler` | Honest "reconnecting" state; history refills the gap |
| Live stats | Message webhooks, signature-checked | Counts real messages server-side without relaying chat |

Not available in Nexconn, so built in SameBall: slow mode (enforced in the client; no Nexconn slow-mode API), spoiler-safe push (not built yet), voice huddle (needs Nexconn Call; the 5-second gate and screen ship today).

Nexconn carries every chat message. SameBall's server never relays chat; it issues tokens, runs the bots and moderation, and counts webhook events.

## Traction

<!-- Take these from https://sameball.vercel.app/stats on the day you export. Test and bot users are excluded there automatically. -->

As of `<DATE>` (from our public `/stats` page, which excludes test and bot accounts):

| | |
|---|---|
| Users connected | `<N>` |
| Rooms created | `<N>` |
| Messages sent | `<N>` |
| Spoilers blocked (messages that arrived locked and revealed on schedule) | `<N>` |
| Roars | `<N>` |
| Median delay spread per room | `<N> s` |

`<SCREENSHOT: /stats page>`

`<SCREENSHOT: daily active users chart>`

## What users said

<!-- Real quotes only, with permission. From the in-app feedback prompt or messages to you. -->

> "`<quote>`"
> — `<first name>`, `<context, e.g. watched IND vs AUS on Hotstar>`

> "`<quote>`"
> — `<first name>`, `<context>`

## Business model

- **Free consumer app.** Spoiler-free watch rooms for friends and fan groups. The free app is how we grow.
- **Sponsor-branded roar packs and moment cards.** A brand can sponsor the roar sound of a final, or the share card for The Wave after a wicket. These are opt-in, tied to big moments, and never touch the chat itself.
- **"SameBall Sync" for businesses.** The timing layer as a product for streaming platforms, sports communities and fantasy apps that run live chat beside a video feed. That includes Nexconn's own live-stream customers: their viewers are on different delays too, and SameBall Sync would let any chat built on Nexconn reveal messages in step with each viewer's video.

## Roadmap

1. **Huddle voice on Nexconn Call.** The 5-second gate ships today; the call itself waits on enabling Nexconn Call.
2. **A real ball-by-ball feed** behind the existing `ScoreProvider` interface (only the demo provider ships today).
3. **Spoiler-safe push:** a notification at the reader's own reveal time, with a content-free preview, opt-in and per-room mute.
4. **Automatic delay detection** from the broadcast audio, with no taps.
5. **More languages** (Marathi, Malayalam, Gujarati) and the SameBall Sync SDK for one streaming or fantasy partner.

## How to test without a live match

**Judge Mode (alone, one device):**

1. Open https://sameball.vercel.app/try and tap **Start the demo**.
2. Tap **Start the over**. You're on a slower feed than the bot friends Arjun 📺 and Meera 🏟️.
3. Their messages arrive locked ("unlocks in 12s"), Hype Radar pulses before the big ball, and the chat unlocks exactly when the six lands on your scoreboard.
4. After the FOUR, Arjun asks "Ball 4?" (Call it). Pick before the ball reaches your screen; the answer and the points show only once the six has landed for you.
5. Tap ⏱ to change your feed and watch the timing change. "Open a second window on the TV feed" shows the other side.

**The Judges' room (a real match night, replayed):**

<!-- Record this during a real match with real users, then put the code here. Ghost Crowd keeps working for the 180 days Nexconn keeps group history. -->

1. Open `https://sameball.vercel.app/r/<JUDGES_ROOM_CODE>?replay=1`.
2. Start the match highlights `<VIDEO LINK>` and tap **Sync** when the video shows "`<anchor, e.g. First ball>`".
3. The real chat and roars from that night replay in step with the video. Use ±10 s if the chat feels early or late.

**Two devices:** create a room on the home page, open the invite on a second device, pick TV on one and Streaming app on the other, and send "SIX!" from the TV phone.
