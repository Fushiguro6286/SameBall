// Live score providers. The server turns a provider's latest score into an SB:Score message from the host bot
// (lag 0), so each viewer's own hold applies and the strip never runs ahead of their TV.

export interface ScoreProvider {
  id: string;
  /** One short score line (≤ 40 chars), or null when there's nothing to show yet. */
  current(room: { name: string; startedAt: number }, now: number): Promise<string | null>;
}

const BALL_MS = 40_000;
// Weighted ball outcomes for the demo innings: runs, or -1 for a wicket.
const OUTCOMES = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 4, 4, 4, 6, 6, -1];

/** Deterministic demo innings: one ball every 40 s from `startedAt`. Same inputs, same score, on any server. */
export function mockScore(team: string, startedAt: number, now: number): string | null {
  const balls = Math.min(120, Math.floor((now - startedAt) / BALL_MS));
  if (balls < 1) return null;
  let seed = 7;
  let runs = 0;
  let wkts = 0;
  for (let i = 0; i < balls && wkts < 10; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const r = OUTCOMES[seed % OUTCOMES.length];
    if (r < 0) wkts++;
    else runs += r;
  }
  return `${team.slice(0, 20)} ${runs}/${wkts} (${Math.floor(balls / 6)}.${balls % 6})`;
}

export const mockProvider: ScoreProvider = {
  id: "mock",
  current: async (room, now) => mockScore(room.name.split(/ vs /i)[0].trim() || "Home XI", room.startedAt, now),
};

// shortcut: no real cricket feed yet; CricketData.org's public docs don't list its response fields, so a real
// provider would guess at its API. Add one behind this interface once the fields are verified.
