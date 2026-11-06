import { describe, expect, it } from "vitest";
import { callsOf } from "./callit";
import type { ChatMsg } from "./engine";

let n = 0;
const msg = (kind: ChatMsg["kind"], senderId: string, sentTime: number, lag: number, payload: Record<string, unknown>): ChatMsg => ({
  id: `m${n++}`,
  kind,
  senderId,
  senderName: senderId,
  avatar: "🙂",
  sentTime,
  lag,
  payload,
});
const call = (by: string, t: number, lag = 0) => msg("call", by, t, lag, { callId: "c1", q: "Next ball?", opts: ["Dot", "4", "6", "OUT"] });
const vote = (by: string, t: number, lag: number, pick: number) => msg("callvote", by, t, lag, { callId: "c1", pick });
const result = (by: string, t: number, lag: number, answer: number) => msg("callresult", by, t, lag, { callId: "c1", answer });
const all = () => true;

describe("Call it", () => {
  // The six happens at match time 100 s. TV is live, streaming is 30 s behind.
  it("a slow feed can pick until the ball reaches its screen; a fast feed can't pick after it", () => {
    const msgs = [
      call("tv", 90_000),
      vote("stream", 128_000, 30_000, 2), // match time 98 s: before the six on their screen
      vote("tv", 101_000, 0, 2), // match time 101 s: after the six, too late
      result("tv", 102_000, 0, 2), // asker answers 2 s after the six; the 3 s margin puts the deadline before it
    ];
    const { current, board } = callsOf(msgs, all, "stream");
    expect(current?.answer).toBe(2);
    expect(current?.mine).toBe(2);
    expect(current?.winners.map((w) => w.senderId)).toEqual(["stream"]);
    expect(board).toEqual([expect.objectContaining({ senderId: "stream", points: 1 })]);
  });

  it("Lock picks sets an exact deadline, which reaches each screen at its own time", () => {
    // Lock at match time 99 s (bowler running in). Streaming (30 s behind) picks at match time 98.5 s: counts.
    const msgs = [call("tv", 90_000), result("tv", 99_000, 0, -1), vote("stream", 128_500, 30_000, 1), vote("late", 99_500, 0, 1), result("tv", 110_000, 0, 1)];
    const { current } = callsOf(msgs, all, "stream");
    expect(current?.closed).toBe(true);
    expect(current?.answer).toBe(1);
    expect(current?.winners.map((w) => w.senderId)).toEqual(["stream"]);
    // Before the lock reaches my screen, picks are still open for me.
    const notYet = callsOf(msgs, (id) => id !== msgs[1].id && id !== msgs[4].id, "stream").current;
    expect(notYet?.closed).toBe(false);
  });

  it("counts each person's latest pick before the deadline", () => {
    const msgs = [call("a", 0), vote("b", 1000, 0, 0), vote("b", 2000, 0, 3), vote("b", 9000, 0, 1), result("a", 8000, 0, 3)];
    const { current } = callsOf(msgs, all, "b");
    expect(current?.mine).toBe(3);
    expect(current?.winners.map((w) => w.senderId)).toEqual(["b"]);
  });

  it("hides the answer and others' picks until they're revealed for me", () => {
    const msgs = [call("a", 0), vote("b", 1000, 0, 1), vote("me", 1500, 0, 2), result("a", 5000, 0, 1)];
    const revealed = new Set([msgs[0].id, msgs[2].id]);
    const { current, board } = callsOf(msgs, (id) => revealed.has(id), "me");
    expect(current?.answer).toBeNull();
    expect(current?.answered).toBe(true);
    expect(current?.pickers).toBe(1); // only my own pick is visible
    expect(current?.winners).toEqual([]);
    expect(board).toEqual([]);
  });

  it("ignores answers from anyone but the asker, and calls not yet revealed", () => {
    const msgs = [call("a", 0), result("x", 1000, 0, 0)];
    expect(callsOf(msgs, all, "me").current?.answered).toBe(false);
    expect(callsOf(msgs, () => false, "me").current).toBeNull();
  });
});

describe("Call it streaks", () => {
  const round = (id: string, t: number, picks: [string, number][], answer: number) => [
    msg("call", "host", t, 0, { callId: id, q: "Next ball?", opts: ["Dot", "4", "6", "OUT"] }),
    ...picks.map(([who, pick], i) => msg("callvote", who, t + 1000 + i, 0, { callId: id, pick })),
    msg("callresult", "host", t + 20_000, 0, { callId: id, answer }),
  ];
  it("counts the longest run of correct calls; a wrong pick ends it, skipping doesn't", () => {
    const msgs = [
      ...round("a", 0, [["asha", 1], ["ravi", 1]], 1),
      ...round("b", 60_000, [["asha", 2], ["ravi", 0]], 2),
      ...round("c", 120_000, [["ravi", 3]], 3), // asha skips: her run continues
      ...round("d", 180_000, [["asha", 0], ["ravi", 0]], 0),
    ];
    const { board } = callsOf(msgs, () => true, "asha");
    expect(board.find((b) => b.senderId === "asha")).toMatchObject({ points: 3, best: 3 });
    expect(board.find((b) => b.senderId === "ravi")).toMatchObject({ points: 3, best: 2 });
  });
});
