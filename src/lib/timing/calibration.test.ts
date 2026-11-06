import { describe, expect, it } from "vitest";
import { suggestLag } from "./calibration";
import type { Moment, Reactor } from "./wave";

const r = (senderId: string, firstSent: number, lag: number): Reactor => ({ senderId, name: senderId, avatar: "🦁", lag, firstSent });
const moment = (t: number, reactors: Reactor[]): Moment => ({ id: `m${t}`, matchTime: t, reactors });

// Real feeds: a is live (0 s), b is 20 s behind, I'm really 30 s behind but my setting says 20 s.
// Reactions land a couple of seconds after each moment reaches each screen.
const night = [
  moment(100_000, [r("a", 102_000, 0), r("b", 121_500, 20_000), r("me", 132_000, 20_000)]),
  moment(400_000, [r("a", 401_500, 0), r("b", 422_000, 20_000), r("me", 431_500, 20_000)]),
];

describe("suggestLag", () => {
  it("estimates my real lag from friends' reactions and suggests the change", () => {
    expect(suggestLag(night, "me", 20_000)).toEqual({ lag: 30_000, delta: 10_000, moments: 2 });
  });

  it("is independent of my stamped lag, so applying it makes the suggestion go away", () => {
    expect(suggestLag(night, "me", 30_000)).toBeNull();
  });

  it("needs two shared moments", () => {
    expect(suggestLag(night.slice(0, 1), "me", 20_000)).toBeNull();
  });

  it("ignores moments I didn't react to, and small differences", () => {
    const without = night.map((m) => ({ ...m, reactors: m.reactors.filter((x) => x.senderId !== "me") }));
    expect(suggestLag(without, "me", 20_000)).toBeNull();
    expect(suggestLag(night, "me", 28_000)).toBeNull(); // 2 s off: reaction-speed noise
  });

  it("a slow reactor among friends doesn't drag the median", () => {
    const withSlow = night.map((m, i) => ({ ...m, reactors: [...m.reactors, r("slowpoke", m.matchTime + 15_000 + i, 0)] }));
    expect(suggestLag(withSlow, "me", 20_000)?.lag).toBe(30_000);
  });

  it("never suggests a negative lag", () => {
    const early = night.map((m) => ({ ...m, reactors: m.reactors.map((x) => (x.senderId === "me" ? { ...x, firstSent: m.matchTime - 5_000 } : x)) }));
    expect(suggestLag(early, "me", 10_000)).toEqual({ lag: 0, delta: -10_000, moments: 2 });
  });
});
