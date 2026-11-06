import { describe, expect, it } from "vitest";
import type { ChatMsg } from "./engine";
import { leagueOf } from "./league";

let n = 0;
const msg = (kind: ChatMsg["kind"], senderId: string, sentTime: number, payload: Record<string, unknown>): ChatMsg => ({
  id: `m${n++}`,
  kind,
  senderId,
  senderName: senderId,
  avatar: "🙂",
  sentTime,
  lag: 0,
  payload,
});
/** One Call it at time t: `winners` pick the right answer (1), everyone else picks 0. */
const round = (t: number, id: string, winners: string[], losers: string[] = []) => [
  msg("call", "owner", t, { callId: id, q: "Next ball?", opts: ["Dot", "Six"] }),
  ...winners.map((w) => msg("callvote", w, t + 1000, { callId: id, pick: 1 })),
  ...losers.map((w) => msg("callvote", w, t + 1000, { callId: id, pick: 0 })),
  msg("callresult", "owner", t + 60_000, { callId: id, answer: 1 }),
];
const series = (t: number, name: string, by = "owner") => msg("anchor", by, t, { label: `🏆 ${name}` });
const all = () => true;

describe("series league", () => {
  it("without a series, every match so far counts", () => {
    const l = leagueOf([...round(0, "a", ["asha"]), ...round(500_000, "b", ["asha", "ravi"])], all, "me", "owner");
    expect(l.series).toBeNull();
    expect(l.board.map((p) => [p.senderId, p.points])).toEqual([["asha", 2], ["ravi", 1]]);
    expect(l.champion).toBeNull();
  });

  it("a new series resets points and crowns the previous series' leader", () => {
    const msgs = [
      series(0, "Asia Cup"),
      ...round(10_000, "a", ["asha"], ["ravi"]),
      ...round(200_000, "b", ["asha"]),
      series(1_000_000, "NZ ODIs"),
      ...round(1_100_000, "c", ["ravi"], ["asha"]),
    ];
    const l = leagueOf(msgs, all, "me", "owner");
    expect(l.series).toBe("NZ ODIs");
    expect(l.board.map((p) => [p.senderId, p.points])).toEqual([["ravi", 1]]);
    expect(l.champion).toMatchObject({ series: "Asia Cup", who: { senderId: "asha", points: 2 } });
  });

  it("ignores series markers from non-owners and ones not yet on my screen", () => {
    const fake = series(100_000, "Fake", "ravi");
    const ahead = series(900_000, "Not yet");
    const msgs = [...round(0, "a", ["asha"]), fake, ahead];
    const l = leagueOf(msgs, (id) => id !== ahead.id, "me", "owner");
    expect(l.series).toBeNull();
    expect(l.board[0]).toMatchObject({ senderId: "asha", points: 1 });
  });
});
