// Gated Huddle: voice only opens when every member's screen is within 5 s of the same moment, so nobody
// hears a goal before they see it.

export const HUDDLE_SPREAD_MS = 5000;

export interface HuddleMember {
  senderId: string;
  name: string;
  lag: number;
}

/** open = at least two people and every delay within 5 s; `off` lists who's outside the window (vs the median). */
export function huddleGate(members: HuddleMember[]) {
  const people = members.filter((m) => !m.senderId.startsWith("bot_"));
  const lags = people.map((m) => m.lag).sort((a, b) => a - b);
  const spreadMs = lags.length ? lags.at(-1)! - lags[0] : 0;
  const mid = lags[Math.floor(lags.length / 2)] ?? 0;
  const off = people.filter((m) => Math.abs(m.lag - mid) > HUDDLE_SPREAD_MS / 2 && spreadMs > HUDDLE_SPREAD_MS).map((m) => ({ ...m, byMs: m.lag - mid }));
  return { open: people.length >= 2 && spreadMs <= HUDDLE_SPREAD_MS, spreadMs, off, count: people.length };
}
