import { describe, expect, it } from "vitest";
import type { ChatMsg } from "./engine";
import { findMoments, reachedAllAt, waveOf } from "./wave";

let n = 0;
const roar = (senderId: string, sentTime: number, lag: number, intensity = 2): ChatMsg => ({
  id: `m${n++}`,
  senderId,
  senderName: senderId,
  avatar: "🦁",
  kind: "roar",
  payload: { intensity },
  lag,
  sentTime,
});

describe("findMoments", () => {
  it("needs two people: one person roaring alone is not a moment", () => {
    expect(findMoments([roar("a", 0, 0, 3), roar("a", 1500, 0, 3), roar("a", 3000, 0, 3)])).toEqual([]);
  });

  it("groups reactions by match time, not arrival time", () => {
    // Same moment at match time 100s: a is live, b is 30s behind so b's roars arrive 30s later.
    const ms = findMoments([roar("a", 100_000, 0), roar("a", 101_500, 0), roar("b", 131_000, 30_000), roar("b", 132_000, 30_000)]);
    expect(ms).toHaveLength(1);
    expect(ms[0].matchTime).toBe(100_000);
    expect(ms[0].reactors.map((r) => [r.senderId, r.lag])).toEqual([
      ["a", 0],
      ["b", 30_000],
    ]);
  });

  it("finds separate moments and doesn't double count one", () => {
    const burst = (t: number) => [roar("a", t, 0), roar("b", t + 2000, 0), roar("a", t + 4000, 0)];
    expect(findMoments([...burst(0), ...burst(120_000)]).map((m) => m.matchTime)).toEqual([0, 120_000]);
  });

  it("ignores malformed stamps, control messages and replay viewers", () => {
    const bad = { ...roar("b", 0, 0, 3), lag: null };
    const lag = { ...roar("b", 0, 0), kind: "lag" as const };
    const ghost = roar("c", 2 * 86_400_000, 2 * 86_400_000, 3); // same match time, replayed two days later
    expect(findMoments([roar("a", 0, 0, 3), bad, lag, ghost])).toEqual([]);
  });
});

describe("waveOf", () => {
  it("hit time = moment.matchTime + lag, fastest first, reactor stamps win", () => {
    const m = findMoments([roar("a", 100_000, 5_000), roar("b", 120_000, 25_000), roar("b", 121_000, 25_000)])[0];
    const w = waveOf(m, [
      { senderId: "a", name: "a", avatar: "🦁", lag: 9_000 }, // stale latest lag; the reaction stamp (5s) wins
      { senderId: "c", name: "c", avatar: "🐼", lag: 45_000 }, // silent member still gets a dot
    ]);
    expect(w.dots.map((d) => [d.senderId, d.hitAt, d.offset])).toEqual([
      ["a", 100_000, 0],
      ["b", 120_000, 20_000],
      ["c", 140_000, 40_000],
    ]);
    expect(w.spreadMs).toBe(40_000);
  });
});

describe("moment cards", () => {
  it("keeps each reactor's first reaction text and knows when the moment reached every screen", () => {
    const chip = { ...roar("b", 131_000, 30_000), kind: "text" as const, text: "SIX! 🔥", payload: undefined };
    const [m] = findMoments([roar("a", 100_000, 0), roar("a", 101_500, 0), chip, roar("b", 132_000, 30_000)]);
    expect(m.reactors.map((r) => r.text)).toEqual([null, "SIX! 🔥"]);
    // A silent member on a 45 s feed is the last screen to see it.
    expect(reachedAllAt(m, [{ senderId: "c", name: "c", avatar: "🐼", lag: 45_000 }])).toBe(145_000);
    expect(reachedAllAt(m, [])).toBe(130_000);
  });
});
