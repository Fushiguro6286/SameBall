import { describe, expect, it } from "vitest";
import { mockScore } from "./score";

describe("mock score provider", () => {
  it("is empty before the first ball, then one ball per 40 s", () => {
    expect(mockScore("IND", 0, 39_000)).toBeNull();
    expect(mockScore("IND", 0, 40_000)).toMatch(/^IND \d+\/\d \(0\.1\)$/);
    expect(mockScore("IND", 0, 7 * 40_000)).toMatch(/\(1\.1\)$/);
  });

  it("is deterministic and only goes up", () => {
    const runs = (t: number) => Number(mockScore("IND", 0, t)!.split(" ")[1].split("/")[0]);
    expect(mockScore("IND", 0, 400_000)).toBe(mockScore("IND", 0, 400_000));
    expect(runs(800_000)).toBeGreaterThanOrEqual(runs(400_000));
  });

  it("stops at 20 overs", () => {
    expect(mockScore("IND", 0, 10 ** 9)).toMatch(/\(20\.0\)$/);
  });
});
