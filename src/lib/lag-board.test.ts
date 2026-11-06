import { describe, expect, it } from "vitest";
import { rankLags } from "./lag-board";

const e = (name: string, lag: number) => ({ senderId: name, name, avatar: "🦁", lag });

describe("lag leaderboard", () => {
  it("fastest is the live wire, slowest is in the past, others show +Ns relative to the fastest", () => {
    const r = rankLags([e("Priya", 55_000), e("Arjun", 8_000), e("Sam", 20_000)]);
    expect(r.map((x) => x.name)).toEqual(["Arjun", "Sam", "Priya"]);
    expect(r.map((x) => x.badge)).toEqual([{ kind: "fastest" }, { kind: "behind", s: 12 }, { kind: "slowest", s: 47 }]);
  });
  it("ties at the front are all live wires; one member alone is too", () => {
    expect(rankLags([e("A", 0), e("B", 0)]).every((x) => x.badge.kind === "fastest")).toBe(true);
    expect(rankLags([e("A", 30_000)])[0].badge).toEqual({ kind: "fastest" });
    expect(rankLags([])).toEqual([]);
  });
});
