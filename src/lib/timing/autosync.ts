// Auto-sync from reactions. When the fastest-feed friend reacts "SIX!" at server time t0 and I react "SIX!" at t1,
// I'm (t1 − t0) behind their screen, so my delay ≈ (t1 − t0) + their delay. Reaction speed differs per person,
// so we take the median of several observations and only suggest when they agree. Never applied silently.
// Input must be messages already revealed for me, so a suggestion can't hint at a moment I haven't seen.

import { median } from "./clock";
import { LIVE_MAX_LAG_MS, type ChatMsg } from "./engine";

/** Same-type reactions this far apart (or less) can be the same moment. */
export const AUTOSYNC_WINDOW_MS = 120_000;
/** A member's repeated reactions of one type within this gap count once (roars repeat every 1.5 s). */
const BURST_MS = 20_000;
export const AUTOSYNC_MIN_OBS = 3;
/** Only the latest observations count, so drift shows up. */
export const AUTOSYNC_RECENT = 7;
/** First suggestion: the estimate must differ from my setting by more than this. */
export const AUTOSYNC_MIN_DELTA_MS = 3000;
/** After I applied a suggestion: nudge again only if I've slipped this much. */
export const AUTOSYNC_DRIFT_MS = 5000;
/** Observations must agree: spread (2 × median absolute deviation) under this. */
export const AUTOSYNC_MAX_SPREAD_MS = 8000;

/** Reaction types. Only the same type can be the same moment ("SIX!" never pairs with "OUT!"). */
const KEYS: [string, RegExp][] = [
  ["six", /\bsix(?:er)?\b|\bchhokka\b|छक्का|சிக்ஸ|సిక్స|ছক্কা|ಸಿಕ್ಸ/i],
  ["four", /\bfour\b|चौका|ஃபோர்|ఫోర్|চার|ಫೋರ್/i],
  ["out", /\bout\b|\bwicket\b|\bhowzat\b|\bbowled\b|आउट|विकेट|அவுட்|అవుట్|আউট|ಔಟ್/i],
  ["catch", /\bcatch\b/i],
  ["goal", /\bgoal+\b|गोल/i],
  ["save", /\bsave\b/i],
  ["card", /\bred card\b/i],
  ["overtake", /\bovertake\b/i],
  ["clutch", /\bclutch\b|\bace\b/i],
];

/** Moment type of a message, or null if it isn't a moment reaction. Roars are their own type. */
export function reactionKey(m: ChatMsg): string | null {
  if (m.kind === "roar") return "roar";
  if (m.kind !== "text" || !m.text || m.text.length > 60) return null; // long messages are chat, not reactions
  return KEYS.find(([, re]) => re.test(m.text!))?.[0] ?? null;
}

export interface Observation {
  key: string;
  /** How far behind the reference (fastest) screen I reacted, ms. */
  behind: number;
  /** The reference member's delay stamp. */
  refLag: number;
  /** behind + refLag: an estimate of my real delay. */
  estimate: number;
  at: number;
}

interface Reaction {
  senderId: string;
  key: string;
  sentTime: number;
  lag: number;
}

function reactions(msgs: ChatMsg[]): Reaction[] {
  const out: Reaction[] = [];
  const last = new Map<string, number>();
  for (const m of [...msgs].sort((a, b) => a.sentTime - b.sentTime)) {
    if (m.lag === null || m.lag > LIVE_MAX_LAG_MS) continue;
    const key = reactionKey(m);
    if (!key) continue;
    const k = `${m.senderId}|${key}`;
    const prev = last.get(k);
    last.set(k, m.sentTime);
    if (prev !== undefined && m.sentTime - prev < BURST_MS) continue;
    out.push({ senderId: m.senderId, key, sentTime: m.sentTime, lag: m.lag });
  }
  return out;
}

/** Each of my reactions vs the fastest friend who sent the same type up to 2 minutes earlier. */
export function observe(revealed: ChatMsg[], myId: string): Observation[] {
  const rs = reactions(revealed);
  const obs: Observation[] = [];
  for (const mine of rs) {
    if (mine.senderId !== myId) continue;
    let ref: Reaction | null = null;
    for (const r of rs) {
      if (r.senderId === myId || r.key !== mine.key) continue;
      const d = mine.sentTime - r.sentTime;
      if (d < 0 || d > AUTOSYNC_WINDOW_MS) continue;
      // The fastest feed is the reference; between equal feeds, the reaction closest in time.
      if (!ref || r.lag < ref.lag || (r.lag === ref.lag && r.sentTime > ref.sentTime)) ref = r;
    }
    if (ref) obs.push({ key: mine.key, behind: mine.sentTime - ref.sentTime, refLag: ref.lag, estimate: mine.sentTime - ref.sentTime + ref.lag, at: mine.sentTime });
  }
  return obs;
}

export interface SyncSuggestion {
  /** Suggested delay, ms (whole seconds). */
  lag: number;
  /** Median time behind the fastest screen, ms. */
  behind: number;
  /** lag − current. */
  delta: number;
  spread: number;
  observations: number;
  /** I already applied a suggestion and have slipped since. */
  drift: boolean;
}

/** `applied`: my current delay came from an earlier suggestion, so only real drift (≥ 5 s) triggers a nudge. */
export function suggestSync(obs: Observation[], myLag: number, applied: boolean): SyncSuggestion | null {
  const recent = obs.slice(-AUTOSYNC_RECENT);
  if (recent.length < AUTOSYNC_MIN_OBS) return null;
  const est = median(recent.map((o) => o.estimate));
  const spread = 2 * median(recent.map((o) => Math.abs(o.estimate - est)));
  if (spread >= AUTOSYNC_MAX_SPREAD_MS) return null;
  const lag = Math.max(0, Math.round(est / 1000) * 1000);
  const delta = lag - myLag;
  if (Math.abs(delta) < (applied ? AUTOSYNC_DRIFT_MS : AUTOSYNC_MIN_DELTA_MS + 1)) return null;
  return { lag, behind: Math.max(0, median(recent.map((o) => o.behind))), delta, spread, observations: obs.length, drift: applied };
}
