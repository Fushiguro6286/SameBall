import { describe, expect, it } from "vitest";
import type { ChatMsg } from "./engine";
import { HYPE_HIGH, hypeHeat, hypeWeight, type Pending } from "./hype";
import { RoomStore } from "./room-store";

const text = (t: string, p: Partial<ChatMsg> = {}): ChatMsg => ({
  id: Math.random().toString(36),
  senderId: "a",
  senderName: "A",
  avatar: "🦁",
  kind: "text",
  text: t,
  lag: 0,
  sentTime: 0,
  ...p,
});

describe("hype score", () => {
  it("weighs caps, emoji, !! and chips above plain text", () => {
    expect(hypeWeight(text("nice"))).toBe(1);
    expect(hypeWeight(text("WHAT A SHOT!! 🔥🔥"))).toBeGreaterThan(2.5);
    expect(hypeWeight(text("SIX! 🔥"))).toBeGreaterThan(hypeWeight(text("SIX! 🔥 lol")));
  });
  it("counts roars by intensity and ignores control messages", () => {
    expect(hypeWeight({ ...text(""), kind: "roar", payload: { intensity: 3 } })).toBeCloseTo(3.6);
    expect(hypeWeight({ ...text(""), kind: "lag", payload: {} })).toBe(0);
  });
  it("is zero with nothing pending and ignores messages outside the 45 s window", () => {
    expect(hypeHeat([], 0).heat).toBe(0);
    const p: Pending[] = [
      { revealAt: -1, senderId: "a", weight: 5 },
      { revealAt: 46_000, senderId: "b", weight: 5 },
    ];
    expect(hypeHeat(p, 0)).toEqual({ heat: 0, nextAt: null });
  });
  it("distinct senders matter more than one sender spamming", () => {
    const spam = Array.from({ length: 3 }, (_, i) => ({ revealAt: 5000 + i, senderId: "a", weight: 1 }));
    const crowd = Array.from({ length: 3 }, (_, i) => ({ revealAt: 5000 + i, senderId: `s${i}`, weight: 1 }));
    expect(hypeHeat(crowd, 0).heat).toBeGreaterThan(hypeHeat(spam, 0).heat);
    expect(hypeHeat(crowd, 0).nextAt).toBe(5000);
  });
  it("a squad shouting chips crosses the high threshold; one quiet message does not", () => {
    const loud = ["a", "b", "c"].map((s) => ({ revealAt: 9000, senderId: s, weight: hypeWeight(text("SIX! 🔥")) }));
    expect(hypeHeat(loud, 0).heat).toBeGreaterThan(HYPE_HIGH);
    expect(hypeHeat([{ revealAt: 9000, senderId: "a", weight: 1 }], 0).heat).toBeLessThan(HYPE_HIGH);
  });
  it("the store exposes only locked messages, as numbers without content", () => {
    const now = 100_000;
    const st = new RoomStore("me", 25_000, () => now);
    st.add([text("SIX!!", { id: "locked", sentTime: now }), text("old", { id: "seen", sentTime: now - 60_000 })]);
    const p = st.pending();
    expect(p).toHaveLength(1);
    expect(Object.keys(p[0]).sort()).toEqual(["revealAt", "senderId", "weight"]);
    expect(p[0].revealAt).toBe(now + 25_000);
    st.dispose();
  });
});
