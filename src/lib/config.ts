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

export const AVATARS = ["🦁", "🐯", "🦊", "🐼", "🐸", "🦉", "🐙", "🦄", "🐝", "🔥", "⚡", "🎯", "🏏", "⚽", "🏎️", "🎮"] as const;

export const SLIDER_MAX_S = 120;
export const NUDGE_SPOILED_S = 5;
export const NUDGE_LATE_S = -3;

/** Free-plan group channel size we design for; full rooms overflow into "Stand B", "Stand C"... */
export const ROOM_CAP = 300;
export const NAME_MAX = 30;
export const ROOM_NAME_MAX = 60;
export const MESSAGE_MAX = 500;
export const HISTORY_PAGES = 3; // x100 messages
export const FEEDBACK_AFTER_MS = 20 * 60_000;
