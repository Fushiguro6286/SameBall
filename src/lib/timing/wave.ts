// The Wave: find big moments from reactions, then show how one moment rippled across the squad's feeds.
// Input must be messages already revealed for me, so a moment never shows before it reached my screen.

import { LIVE_MAX_LAG_MS, matchTime, type ChatMsg } from "./engine";
import { hypeWeight } from "./hype";

/** Reactions within this much match time belong to the same moment. */
export const MOMENT_WINDOW_MS = 15_000; // wide enough to catch someone whose lag setting is ~10 s off (auto-calibration)
/** Minimum summed hype weight (two short roars plus a chip clear it; one person alone never does). */
export const MOMENT_MIN_WEIGHT = 6;
/** A new moment needs this much match time after the previous one's reactions. */
const MOMENT_GAP_MS = 30_000;

export interface Who {
  senderId: string;
  name: string;
  avatar: string;
  lag: number;
}

export interface Reactor extends Who {
  firstSent: number;
}

export interface Moment {
  /** Id of the first reaction, so it stays stable as more history loads. */
  id: string;
  matchTime: number;
  /** Each reacting member's first reaction: its server time and the lag stamped on it. */
  reactors: Reactor[];
}

/** Replay viewers (lag above LIVE_MAX_LAG_MS) are left out: the wave is about live feeds. */
export function findMoments(revealed: ChatMsg[]): Moment[] {
  const msgs = revealed.filter((m) => m.lag !== null && m.lag <= LIVE_MAX_LAG_MS && hypeWeight(m) > 0).sort((a, b) => matchTime(a) - matchTime(b));
  const out: Moment[] = [];
  let j = 0;
  let sum = 0;
  let nextAllowed = -Infinity;
  for (let i = 0; i < msgs.length; i++) {
    const start = matchTime(msgs[i]);
    // Grow the window [i, j) to cover [start, start + WINDOW].
    while (j < msgs.length && matchTime(msgs[j]) <= start + MOMENT_WINDOW_MS) sum += hypeWeight(msgs[j++]);
    if (start >= nextAllowed) {
      const win = msgs.slice(i, j);
      const reactors = new Map<string, Reactor>();
      for (const m of win) {
        const prev = reactors.get(m.senderId);
        if (!prev || m.sentTime < prev.firstSent)
          reactors.set(m.senderId, { senderId: m.senderId, name: m.senderName, avatar: m.avatar, lag: m.lag ?? 0, firstSent: m.sentTime });
      }
      if (sum >= MOMENT_MIN_WEIGHT && reactors.size >= 2) {
        out.push({ id: msgs[i].id, matchTime: start, reactors: [...reactors.values()] });
        nextAllowed = matchTime(msgs[j - 1]) + MOMENT_GAP_MS;
      }
    }
    sum -= hypeWeight(msgs[i]);
  }
  return out;
}

export interface Wave {
  /** Fastest feed first. `offset` = ms after the fastest screen. */
  dots: (Who & { hitAt: number; offset: number })[];
  spreadMs: number;
}

/** When the moment hit each member: moment.matchTime + their lag. Reactors use the lag stamped on their reaction. */
export function waveOf(m: Moment, members: Who[]): Wave {
  const byId = new Map<string, Who>();
  for (const w of members) byId.set(w.senderId, w);
  for (const w of m.reactors) byId.set(w.senderId, w);
  const sorted = [...byId.values()].sort((a, b) => a.lag - b.lag || a.name.localeCompare(b.name));
  const min = sorted[0]?.lag ?? 0;
  const dots = sorted.map((w) => ({ ...w, hitAt: m.matchTime + w.lag, offset: w.lag - min }));
  return { dots, spreadMs: dots.length ? dots[dots.length - 1].offset : 0 };
}
