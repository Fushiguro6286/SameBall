// Lag Leaderboard: playful badges relative to the fastest member in the room.

export interface BoardEntry {
  senderId: string;
  name: string;
  avatar: string;
  lag: number;
}
export type Badge = { kind: "fastest" } | { kind: "slowest"; s: number } | { kind: "behind"; s: number };

/** Sorted fastest first, each with a badge. One member alone is the live wire. */
export function rankLags(entries: BoardEntry[]): (BoardEntry & { badge: Badge })[] {
  const sorted = [...entries].sort((a, b) => a.lag - b.lag || a.name.localeCompare(b.name));
  if (!sorted.length) return [];
  const min = sorted[0].lag;
  const max = sorted[sorted.length - 1].lag;
  return sorted.map((e) => {
    const s = Math.round((e.lag - min) / 1000);
    const badge: Badge = s === 0 ? { kind: "fastest" } : e.lag === max ? { kind: "slowest", s } : { kind: "behind", s };
    return { ...e, badge };
  });
}
