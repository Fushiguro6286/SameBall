// Product constants. Presets are rough defaults; users fine-tune with the slider.

export const LAG_SOURCES = [
  { id: "tv", emoji: "📺", seconds: 8 },
  { id: "dth", emoji: "🛰️", seconds: 12 },
  { id: "streaming", emoji: "📱", seconds: 25 },
  { id: "web", emoji: "🌐", seconds: 40 },
  { id: "radio", emoji: "📻", seconds: 3 },
  { id: "venue", emoji: "🏟️", seconds: 0 },
] as const;
export type LagSourceId = (typeof LAG_SOURCES)[number]["id"] | "custom";

export const SPORTS = ["cricket", "football", "f1", "esports", "other"] as const;
export type Sport = (typeof SPORTS)[number];

/** One-tap quick-chat chips per sport. They send normal text and weigh extra in the Hype score. */
export const QUICK_CHIPS: Record<Sport, readonly string[]> = {
  cricket: ["SIX! 🔥", "OUT!! ☝️", "FOUR! 💥", "What a catch!", "DRS?", "Kya shot hai!"],
  football: ["GOAL!!", "What a save! 🧤", "Offside?", "Red card!", "VAR?", "So close 😱"],
  f1: ["Overtake!! 🏎️", "Safety car?", "Box box!", "Fastest lap ⚡", "Track limits?", "What a move!"],
  esports: ["GG!", "Clutch!! 🔥", "ACE!", "What a play!", "Throw?", "Comeback?"],
  other: ["WOW!! 🔥", "No way!", "Let's go!!", "Unreal 😱", "So close!"],
};
export const ALL_CHIPS: ReadonlySet<string> = new Set(Object.values(QUICK_CHIPS).flat());
export const asSport = (s: string | null | undefined): Sport => (SPORTS as readonly string[]).includes(s ?? "") ? (s as Sport) : "other";

export const AVATARS =["🦁", "🐯", "🦊", "🐼", "🐸", "🦉", "🐙", "🦄", "🐝", "🔥", "⚡", "🎯", "🏏", "⚽", "🏎️", "🎮"] as const;

export const SLIDER_MAX_S = 120;
export const NUDGE_SPOILED_S = 5;
export const NUDGE_LATE_S = -3;

/** Free-plan group channel size we design for; full rooms overflow into "Stand B", "Stand C"... */
export const ROOM_CAP = 300;
export const NAME_MAX = 30;
export const ROOM_NAME_MAX = 60;
export const MESSAGE_MAX = 500;
export const HISTORY_PAGES = 3; // x100 messages
// shortcut: replay loads the newest 2,000 messages only; page on demand if real rooms get bigger.
export const HISTORY_PAGES_REPLAY = 20;
export const FEEDBACK_AFTER_MS = 20 * 60_000;

/** P2 feature flags. Literal env names so Next inlines them at build time. */
export const FEATURES = {
  ghostCrowd: process.env.NEXT_PUBLIC_FEATURE_GHOST_CROWD === "1",
};
