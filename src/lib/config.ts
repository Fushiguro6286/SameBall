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
/** Regional quick-chip packs (native script + transliteration), picked per room. The UI itself stays English/Hindi. */
export const CHIP_PACKS = {
  ta: {
    label: "தமிழ்",
    cricket: ["சிக்ஸர்! 🔥 (Sixer!)", "அவுட்!! ☝️ (Out!)", "ஃபோர்! 💥 (Four!)", "என்ன ஷாட்! (Enna shot!)", "சூப்பர் கேட்ச்! (Super catch!)", "செம்ம! (Semma!)"],
    other: ["செம்ம! (Semma!)", "வேற லெவல்! (Vera level!)", "அய்யோ! (Ayyo!)"],
  },
  te: {
    label: "తెలుగు",
    cricket: ["సిక్సర్! 🔥 (Sixer!)", "అవుట్!! ☝️ (Out!)", "ఫోర్! 💥 (Four!)", "ఏం షాట్! (Em shot!)", "సూపర్ క్యాచ్! (Super catch!)", "అదిరింది! (Adirindi!)"],
    other: ["అదిరింది! (Adirindi!)", "సూపర్! (Super!)", "అయ్యో! (Ayyo!)"],
  },
  bn: {
    label: "বাংলা",
    cricket: ["ছক্কা! 🔥 (Chhokka!)", "আউট!! ☝️ (Out!)", "চার! 💥 (Char!)", "কী শট! (Ki shot!)", "দারুণ ক্যাচ! (Darun catch!)", "দারুণ! (Darun!)"],
    other: ["দারুণ! (Darun!)", "অসাধারণ! (Oshadharon!)", "ইশ! (Ish!)"],
  },
  kn: {
    label: "ಕನ್ನಡ",
    cricket: ["ಸಿಕ್ಸರ್! 🔥 (Sixer!)", "ಔಟ್!! ☝️ (Out!)", "ಫೋರ್! 💥 (Four!)", "ಏನ್ ಶಾಟ್! (En shot!)", "ಸೂಪರ್ ಕ್ಯಾಚ್! (Super catch!)", "ಸಖತ್! (Sakkath!)"],
    other: ["ಸಖತ್! (Sakkath!)", "ಸೂಪರ್! (Super!)", "ಅಯ್ಯೋ! (Ayyo!)"],
  },
} as const;
export type ChipPack = keyof typeof CHIP_PACKS;
export const asChipPack = (s: unknown): ChipPack | null => (typeof s === "string" && s in CHIP_PACKS ? (s as ChipPack) : null);
export const chipsFor = (sport: Sport, pack: ChipPack | null): readonly string[] =>
  pack ? CHIP_PACKS[pack][sport === "cricket" ? "cricket" : "other"] : QUICK_CHIPS[sport];

export const ALL_CHIPS: ReadonlySet<string> = new Set([
  ...Object.values(QUICK_CHIPS).flat(),
  ...Object.values(CHIP_PACKS).flatMap((p) => [...p.cricket, ...p.other]),
]);
export const asSport = (s: string | null | undefined): Sport => (SPORTS as readonly string[]).includes(s ?? "") ? (s as Sport) : "other";

export const AVATARS =["🦁", "🐯", "🦊", "🐼", "🐸", "🦉", "🐙", "🦄", "🐝", "🔥", "⚡", "🎯", "🏏", "⚽", "🏎️", "🎮"] as const;

export const SLIDER_MAX_S = 120;
export const NUDGE_SPOILED_S = 5;
export const NUDGE_LATE_S = -3;

/** Free-plan group channel size we design for; full rooms overflow into "Stand B", "Stand C"... */
export const ROOM_CAP = 300;
/** Stadiums are Nexconn community channels (up to 10,000 members); stands are public sub-channels. */
export const STADIUM_CAP = 10_000;
export const STADIUM_STANDS = ["north", "south", "east"] as const;
export type StandId = (typeof STADIUM_STANDS)[number];
export const asStand = (s: string | null | undefined): StandId | null => ((STADIUM_STANDS as readonly string[]).includes(s ?? "") ? (s as StandId) : null);
export const NAME_MAX = 30;
export const ROOM_NAME_MAX = 60;
export const MESSAGE_MAX = 500;
export const HISTORY_PAGES = 3; // x100 messages
// shortcut: replay loads the newest 2,000 messages only; page on demand if real rooms get bigger.
export const HISTORY_PAGES_REPLAY = 20;
/** "What did I miss?" summarizes at most this many of the latest revealed messages. */
export const CATCHUP_MAX_MSGS = 120;
export const FEEDBACK_AFTER_MS = 20 * 60_000;

/** P2 feature flags. Literal env names so Next inlines them at build time. */
export const FEATURES = {
  ghostCrowd: process.env.NEXT_PUBLIC_FEATURE_GHOST_CROWD === "1",
  wave: process.env.NEXT_PUBLIC_FEATURE_WAVE === "1",
  autoCalibration: process.env.NEXT_PUBLIC_FEATURE_AUTO_CALIBRATION === "1",
  aiCatchup: process.env.NEXT_PUBLIC_FEATURE_AI_CATCHUP === "1",
  stadiums: process.env.NEXT_PUBLIC_FEATURE_STADIUMS === "1",
  hindi: process.env.NEXT_PUBLIC_FEATURE_HINDI === "1",
  callIt: process.env.NEXT_PUBLIC_FEATURE_CALL_IT === "1",
  regionalChips: process.env.NEXT_PUBLIC_FEATURE_REGIONAL_CHIPS === "1",
  couchMode: process.env.NEXT_PUBLIC_FEATURE_COUCH_MODE === "1",
  momentCards: process.env.NEXT_PUBLIC_FEATURE_MOMENT_CARDS === "1",
  voiceNotes: process.env.NEXT_PUBLIC_FEATURE_VOICE_NOTES === "1",
  creatorRooms: process.env.NEXT_PUBLIC_FEATURE_CREATOR_ROOMS === "1",
};

/** Anchor the room creator posts to end the match (each viewer's recap opens when it reaches their screen). */
export const END_LABELS: Record<Sport, string> = {
  cricket: "Match over",
  football: "Full time",
  f1: "Chequered flag",
  esports: "GG · Match over",
  other: "Match over",
};

/** Creator rooms: slow-mode choices for fans, in seconds (0 = off). */
export const SLOW_MODES = [0, 10, 30, 60] as const;

export const GITHUB_URL = "https://github.com/Fushiguro6286/SameBall";
