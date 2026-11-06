// Judge Mode: a scripted final over between fictional teams. Shared by the server (bot steps) and the
// client (mock scoreboard). Times are seconds of match time after the first ball anchor.

export const TRY_BOTS = {
  arjun: { id: "bot_arjun_tv", name: "Arjun", avatar: "📺" },
  meera: { id: "bot_meera_venue", name: "Meera", avatar: "🏟️" },
} as const;
export type BotKey = keyof typeof TRY_BOTS;

export const TRY_TEAMS = { bat: "Rockets XI", bowl: "Thunder XI" };
export const TRY_TARGET = { need: 14, balls: 6, score: "158/6" };
export const TRY_ANCHOR_LABEL = "First ball";

export type BallResult = 0 | 1 | 4 | 6 | "W";
export interface Ball {
  t: number;
  result: BallResult;
}
export const TRY_BALLS: Ball[] = [
  { t: 4, result: 0 },
  { t: 11, result: 4 },
  { t: 18, result: 1 },
  { t: 26, result: 6 },
  { t: 34, result: "W" },
  { t: 42, result: 4 },
];
/** The six: the moment the coach marks build up to. */
export const TRY_SIX_T = 26;
/** Match time when the over is done and the summary can show. */
export const TRY_END_T = 47;

export type TryStep =
  | { t: number; bot: BotKey; kind: "text"; text: string }
  | { t: number; bot: BotKey; kind: "roar"; intensity: 1 | 2 | 3 }
  | { t: number; bot: BotKey; kind: "call" }
  | { t: number; bot: BotKey; kind: "callvote"; pick: number }
  | { t: number; bot: BotKey; kind: "callresult"; answer: number };

/** The Call it question the bots play before the six (answer −1 = lock picks). */
export const TRY_CALL = { callId: "tryball4", q: "Ball 4?", opts: ["Dot", "Runs", "4", "6", "OUT"] };

/** Bot reactions, sent at lag 0 the moment each ball happens on the fastest feed. Max 31 steps (bitmask). */
export const TRY_STEPS: TryStep[] = [
  { t: 1, bot: "arjun", kind: "text", text: "Final over! 14 needed, let's gooo 🙏" },
  { t: 5, bot: "meera", kind: "text", text: "Dot ball. Tight from Thunder" },
  { t: 12, bot: "arjun", kind: "text", text: "FOUR! 💥" },
  { t: 12.5, bot: "meera", kind: "roar", intensity: 2 },
  { t: 19, bot: "meera", kind: "text", text: "Just a single. 9 off 3 now 😬" },
  { t: 26.5, bot: "arjun", kind: "text", text: "SIX! 🔥" },
  { t: 26.7, bot: "arjun", kind: "roar", intensity: 3 },
  { t: 27, bot: "meera", kind: "text", text: "WHAT A HIT!!! INTO THE STANDS 🔥🔥" },
  { t: 27.2, bot: "meera", kind: "roar", intensity: 3 },
  { t: 28.5, bot: "arjun", kind: "roar", intensity: 3 },
  { t: 35, bot: "meera", kind: "text", text: "OUT!! ☝️ noooo" },
  { t: 36, bot: "arjun", kind: "text", text: "3 off the last ball. Can't watch 🙈" },
  { t: 42.5, bot: "arjun", kind: "text", text: "FOUR!! THEY'VE DONE IT 🏆" },
  { t: 42.7, bot: "meera", kind: "roar", intensity: 3 },
  { t: 43, bot: "meera", kind: "text", text: "UNREAL!!! What a finish 😭🔥" },
  { t: 43.2, bot: "arjun", kind: "roar", intensity: 3 },
  // Call it (appended so earlier step numbers stay stable): the six is option 3.
  // Asked right after the FOUR so a first-time visitor has ~12 s to pick before the lock reaches their screen.
  { t: 13, bot: "arjun", kind: "call" },
  { t: 14.5, bot: "meera", kind: "callvote", pick: 3 },
  { t: 16, bot: "arjun", kind: "callvote", pick: 2 },
  { t: 23, bot: "arjun", kind: "callresult", answer: -1 }, // lock well before the six: bot sends land ~1.5 s after their time
  { t: 28, bot: "arjun", kind: "callresult", answer: 3 },
];

/** Scoreboard state at a given match time (seconds). */
export function scoreAt(t: number) {
  const bowled = TRY_BALLS.filter((b) => b.t <= t);
  const runs = bowled.reduce((s, b) => s + (b.result === "W" ? 0 : b.result), 0);
  const wickets = bowled.filter((b) => b.result === "W").length;
  return { bowled, runs, wickets, need: Math.max(0, TRY_TARGET.need - runs), ballsLeft: TRY_TARGET.balls - bowled.length, last: bowled.at(-1) ?? null };
}
