import { describe, expect, it } from "vitest";
import { solveSync } from "./sync-solver";

const tap = (senderId: string, sentTime: number, lag = 0) => ({ senderId, sentTime, lag });

describe("sync check solver", () => {
  it("relative lag = my tap - earliest tap", () => {
    const r = solveSync([tap("tv", 100_000), tap("stream", 134_000), tap("radio", 103_000)]);
    expect(r.get("tv")).toBe(0);
    expect(r.get("radio")).toBe(3_000);
    expect(r.get("stream")).toBe(34_000);
  });
  it("keeps the reference person's current lag as the base", () => {
    const r = solveSync([tap("tv", 100_000, 8_000), tap("stream", 125_000, 30_000)]);
    expect(r.get("tv")).toBe(8_000);
    expect(r.get("stream")).toBe(33_000);
  });
  it("ignores taps more than 180 s from the median", () => {
    const r = solveSync([tap("early", 0), tap("a", 400_000), tap("b", 410_000), tap("c", 420_000)]);
    expect(r.has("early")).toBe(false);
    expect(r.get("a")).toBe(0);
    expect(r.get("c")).toBe(20_000);
  });
  it("counts only each person's first tap", () => {
    const r = solveSync([tap("a", 100_000), tap("b", 110_000), tap("b", 150_000)]);
    expect(r.get("b")).toBe(10_000);
  });
  it("needs at least two people", () => {
    expect(solveSync([tap("a", 1)]).size).toBe(0);
    expect(solveSync([tap("a", 1), tap("a", 2)]).size).toBe(0);
  });
});
