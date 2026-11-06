# Demo video script (under 3 minutes)

## Before recording

- Vercel flags on (they are in production now). Sound on.
- Two phones side by side, screen-recorded together (or filmed with a third camera).
  - Phone A "Priya": feed **TV** (fastest). Phone B "Rahul": feed **Streaming app** (+25 s).
  - Both in the same room, stadium sound on (tap the 🔊 banner).
- Match source: a real match on a TV and a streaming app. With no match on, use Judge Mode (`/try`) plus "Open a second window on the TV feed", side by side in one browser.
- Tabs ready: the architecture slide (the Mermaid diagram from `README.md` or `/how-it-works`) and https://sameball.vercel.app/stats.

## Script

**0:00–0:15 · Two screens, one spoiler**
Show both phones. In an ordinary chat app Priya types "SIX!!" and it pops up on Rahul's phone while his stream still shows the bowler walking back.
> "Priya's on TV. Rahul streams, 25 seconds behind. Her SIX just spoiled his match. SameBall: the group chat that never spoils the match."

**0:15–1:15 · Locked bubbles, Hype Radar, Call it**
- Priya sends "SIX!! 🔥" in SameBall. Rahul sees a locked bubble, "Message from Priya · unlocks in 24s". It unlocks the moment the six lands on his screen.
  > "Rahul knows Priya said something. Not what. It unlocks when the moment reaches him."
- The squad reacts to a big ball. Close-up on Rahul: the Hype Radar heartbeat pulses, "👀 something's coming in 9s".
  > "His squad is losing it over something he hasn't seen yet. Suspense, no spoilers."
- Priya opens ⋯ → 🎯 Call it → "Next ball?". Both pick. Rahul's picks stay open until the ball reaches *his* screen; "You called it!" shows only after it lands for him.
  > "A prediction game the fast feed can't cheat and the slow feed can't spoil."

**1:15–1:45 · Auto-sync, What did I miss?, The Wave**
- Rahul's phone shows "You're 31s behind the fastest screen · Apply". Tap Apply.
  > "SameBall learns your real delay from your reactions."
- Tap "What did I miss?": a short AI summary of messages already unlocked for him.
- Tap the "🌊 rippled through 2 screens" pill: the dots light up in order. Share the story image.

**1:45–2:15 · How it works (architecture slide)**
> "Every message rides on Nexconn: group channels for rooms, community channels for 10,000-fan stadiums, custom message types for roars, predictions and match markers, history for late joiners and replays, webhooks for live stats. Each message carries the sender's delay; the reader's phone holds it until match time plus their own delay. Nexconn delivers fast, SameBall delivers on time."

**2:15–2:45 · Traction and two users**
Cut to `/stats`: users, rooms, spoilers blocked, the daily chart. Then two real quotes on screen.
> "`<N>` fans, `<N>` rooms, `<N>` spoilers blocked." (read the real numbers off `/stats`)
> Quote 1: "`<real user quote>`" (`<name>`)
> Quote 2: "`<real user quote>`" (`<name>`)
> "Try it alone at sameball.vercel.app/try."

<!-- Real numbers and real quotes only, with permission. Leave the beat out rather than invent them. -->

## Spare shots (for cuts)

- A locked bubble with its countdown ring.
- The feed picker ("How are you watching?").
- Lag Leaderboard: "⚡ Live wire" vs "🦕 25s in the past".
- The score strip holding the score until the ball lands on the slow phone.
- A moment card ("reached every screen") and a voice note unlocking.
