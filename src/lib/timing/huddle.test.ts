import { describe, expect, it } from "vitest";
import { huddleGate } from "./huddle";

const m = (senderId: string, lagS: number) => ({ senderId, name: senderId, lag: lagS * 1000 });

describe("huddle gate", () => {
  it("opens only when every screen is within 5 s", () => {
    expect(huddleGate([m("a", 10), m("b", 14)]).open).toBe(true);
    expect(huddleGate([m("a", 10), m("b", 16)]).open).toBe(false);
  });

  it("needs two people and ignores bots", () => {
    expect(huddleGate([m("a", 10)]).open).toBe(false);
    expect(huddleGate([m("a", 10), m("bot_x", 0)]).open).toBe(false);
  });

  it("names who is out of step, against the middle of the squad", () => {
    const g = huddleGate([m("a", 10), m("b", 11), m("c", 30)]);
    expect(g.open).toBe(false);
    expect(g.off.map((o) => [o.senderId, o.byMs])).toEqual([["c", 19_000]]);
  });
});
