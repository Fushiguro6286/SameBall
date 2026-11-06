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
- **Crowd auto-calibration:** SameBall notices when your reactions line up better with a different delay and offers to fix it.
- **The Wave:** after a big moment, watch it ripple across your squad's screens and share it as a story image.
- **Ghost Crowd replay:** watching the recording tomorrow? Sync to a moment and the room's chat and roars replay with your video.
- **"What did I miss?":** an AI summary of what your friends said, built only from messages already revealed on your screen.
- **Big public stadiums:** featured match rooms for up to 10,000 fans, split into stands.
- **Hindi UI**, guest sign-in with no email or phone, report/block/mute, and a "Delete my data" button.

## Nexconn features used

| Feature | Nexconn |
|---|---|
| Match rooms | Group channels (create, join, leave), Web Chat SDK |
| Guest sign-in | Server API access tokens; SDK connect |
| Spoiler-free text | Text messages with an `extra` field carrying the sender's delay |
| Roars, delay announcements, Sync Check, schedule markers, Call it | Eight registered custom message types |
| Late joiners, replay, catch-up | Message history (Ghost Crowd uses the 180-day group history) |
| Judge Mode bot friends, match markers | Server API messages sent as bot users |
| Moderation | Server API mute list and member removal |
| Big public stadiums | Community channels with public sub-channels as stands (10,000 members) |
| Reconnect banner | Connection status events |
| Live stats | Message webhooks, signature-checked and counted on our server |

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

1. **Automatic delay detection.** Sync Check and crowd calibration already find delays from people; next is listening for the broadcast audio to detect the delay with no taps.
2. **Break-time Huddle.** A voice huddle during innings breaks and time-outs, using Nexconn calls.
3. **Score-aware moments.** Pull ball-by-ball data so The Wave and catch-up can name the moment (only once it's revealed for the viewer).
4. **More languages:** Tamil, Telugu, Bengali, Kannada, Marathi.
5. **SameBall Sync SDK** for partners, starting with one streaming or fantasy partner.

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
