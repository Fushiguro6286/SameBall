import { describe, expect, it } from "vitest";
import { TRY_BALLS, TRY_END_T, TRY_SIX_T, TRY_STEPS, TRY_TARGET, scoreAt } from "./try-script";

describe("Judge Mode script", () => {
  it("fits the 31-bit step mask and finishes before the summary", () => {
    expect(TRY_STEPS.length).toBeLessThanOrEqual(31);
    expect(Math.max(...TRY_STEPS.map((s) => s.t))).toBeLessThan(TRY_END_T);
    expect(TRY_BALLS).toHaveLength(TRY_TARGET.balls);
  });
  it("the six is a six, and the chase is won on the last ball", () => {
    expect(TRY_BALLS.find((b) => b.t === TRY_SIX_T)?.result).toBe(6);
    expect(scoreAt(TRY_BALLS[4].t).need).toBe(3);
    expect(scoreAt(TRY_END_T)).toMatchObject({ need: 0, ballsLeft: 0, wickets: 1 });
  });
  it("shows nothing bowled before the first ball", () => {
    expect(scoreAt(-5)).toMatchObject({ runs: 0, ballsLeft: 6, last: null });
  });
});
