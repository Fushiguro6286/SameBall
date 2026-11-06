import { describe, expect, it } from "vitest";
import { observe, reactionKey, suggestSync } from "./autosync";
import type { ChatMsg } from "./engine";
import { CHIP_PACKS } from "../config";

let n = 0;
const msg = (senderId: string, text: string, sentTime: number, lag: number, kind: ChatMsg["kind"] = "text"): ChatMsg => ({
  id: `m${n++}`,
  senderId,
  senderName: senderId,
  avatar: "🙂",
  kind,
  text: kind === "text" ? text : undefined,
  lag,
  sentTime,
});

// Arjun is on TV (stamped 8 s). I'm stamped 25 s but my screen is really ~38 s behind live (30 s behind Arjun).
const T = 1_000_000;
const moment = (at: number, key: string, mineAfter = 30_000) => [msg("arjun", key, at, 8000), msg("me", key, at + mineAfter, 25_000)];

describe("reaction types", () => {
  it("classifies chips and roars, ignores chat", () => {
    expect(reactionKey(msg("a", "SIX! 🔥", 0, 0))).toBe("six");
    expect(reactionKey(msg("a", "OUT!! ☝️", 0, 0))).toBe("out");
    expect(reactionKey(msg("a", "छक्का!!", 0, 0))).toBe("six");
    expect(reactionKey(msg("a", "", 0, 0, "roar"))).toBe("roar");
    expect(reactionKey(msg("a", "anyone want chai?", 0, 0))).toBeNull();
  });

  it("classifies every regional chip pack's six / out / four", () => {
    for (const p of Object.values(CHIP_PACKS)) {
      expect(p.cricket.slice(0, 3).map((c) => reactionKey(msg("a", c, 0, 0)))).toEqual(["six", "out", "four"]);
    }
  });
});

describe("auto-sync estimator", () => {
  it("suggests my real delay after 3 matching moments", () => {
    const msgs = [...moment(T, "SIX!"), ...moment(T + 300_000, "FOUR!"), ...moment(T + 600_000, "OUT!!")];
    const obs = observe(msgs, "me");
    expect(obs.map((o) => o.behind)).toEqual([30_000, 30_000, 30_000]);
    const s = suggestSync(obs, 25_000, false)!;
    expect(s).toMatchObject({ lag: 38_000, behind: 30_000, delta: 13_000, observations: 3, drift: false });
  });

  it("needs at least 3 observations (a single one never suggests)", () => {
    expect(suggestSync(observe(moment(T, "SIX!"), "me"), 25_000, false)).toBeNull();
    expect(suggestSync(observe([...moment(T, "SIX!"), ...moment(T + 300_000, "FOUR!")], "me"), 25_000, false)).toBeNull();
  });

  it("is robust to one outlier, but refuses when observations disagree", () => {
    const robust = [...moment(T, "SIX!"), ...moment(T + 300_000, "FOUR!", 31_000), ...moment(T + 600_000, "OUT!", 29_000), ...moment(T + 900_000, "SIX!", 95_000)];
    expect(suggestSync(observe(robust, "me"), 25_000, false)?.lag).toBe(39_000);
    const messy = [...moment(T, "SIX!", 5_000), ...moment(T + 300_000, "FOUR!", 40_000), ...moment(T + 600_000, "OUT!", 80_000)];
    expect(suggestSync(observe(messy, "me"), 25_000, false)).toBeNull();
  });

  it("never pairs different reaction types", () => {
    const msgs = [msg("arjun", "OUT!!", T, 8000), msg("me", "SIX!", T + 30_000, 25_000), msg("arjun", "FOUR!", T + 300_000, 8000), msg("me", "GOAL", T + 330_000, 25_000)];
    expect(observe(msgs, "me")).toEqual([]);
  });

  it("gives nothing when I'm the fastest feed (I always react first)", () => {
    const msgs = [0, 300_000, 600_000].flatMap((d) => [msg("me", "SIX!", T + d, 0), msg("arjun", "SIX!", T + d + 9_000, 8000)]);
    expect(observe(msgs, "me")).toEqual([]);
  });

  it("uses the fastest friend as the reference and counts a roar burst once", () => {
    const msgs = [
      msg("priya", "SIX!", T + 10_000, 15_000), // slower friend
      msg("arjun", "SIX!", T, 8000), // fastest
      msg("me", "", T + 30_000, 25_000, "roar"),
      msg("me", "", T + 31_500, 25_000, "roar"),
      msg("arjun", "", T + 1000, 8000, "roar"),
      msg("me", "SIX!", T + 30_000, 25_000),
    ];
    const obs = observe(msgs, "me");
    expect(obs).toHaveLength(2); // one SIX, one roar (the second roar is the same burst)
    expect(obs.find((o) => o.key === "six")).toMatchObject({ behind: 30_000, refLag: 8000, estimate: 38_000 });
  });

  it("after applying, nudges only for real drift (≥ 5 s)", () => {
    const msgs = [...moment(T, "SIX!"), ...moment(T + 300_000, "FOUR!"), ...moment(T + 600_000, "OUT!")];
    expect(suggestSync(observe(msgs, "me"), 38_000, true)).toBeNull();
    expect(suggestSync(observe(msgs, "me"), 34_000, true)).toBeNull(); // 4 s off: not drift yet
    // Later moments show I've slipped 8 s further behind (e.g. my stream buffered).
    const slipped = [...msgs, ...[900_000, 1_200_000, 1_500_000, 1_800_000].flatMap((d) => moment(T + d, "SIX!", 38_000))];
    expect(suggestSync(observe(slipped, "me"), 38_000, true)).toMatchObject({ lag: 46_000, delta: 8000, drift: true });
  });
});
