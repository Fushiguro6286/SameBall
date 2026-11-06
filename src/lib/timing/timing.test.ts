import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMsg, MAX_LAG_MS, clampLag, compareMsgs, isLocked, matchTime, revealAt } from "./engine";
import { estimateOffset, measureOffset, median, offsetOf } from "./clock";
import { MinHeap } from "./scheduler";
import { RoomStore } from "./room-store";
import { encodeTextExtra, parseIncoming, RawMsg, SB_TYPES } from "../transport/wire";

const msg = (p: Partial<ChatMsg> & { id: string }): ChatMsg => ({
  senderId: "them",
  senderName: "Them",
  avatar: "🦁",
  kind: "text",
  text: "SIX!",
  lag: 0,
  sentTime: 1_000_000,
  ...p,
});

describe("reveal math", () => {
  it("matchTime = sentTime - senderLag; revealAt = matchTime + myLag", () => {
    const m = msg({ id: "a", sentTime: 100_000, lag: 5_000 });
    expect(matchTime(m)).toBe(95_000);
    expect(revealAt(m, 25_000)).toBe(120_000);
  });
  it("locked until serverNow reaches revealAt, visible at and after", () => {
    const m = msg({ id: "a", sentTime: 100_000, lag: 0 });
    expect(isLocked(m, "me", 25_000, 124_999)).toBe(true);
    expect(isLocked(m, "me", 25_000, 125_000)).toBe(false);
  });
  it("a slower sender's message is not locked for a faster viewer", () => {
    // Sender is 30s behind; I am 10s behind. The moment already passed on my screen.
    const m = msg({ id: "a", sentTime: 100_000, lag: 30_000 });
    expect(isLocked(m, "me", 10_000, 100_000)).toBe(false);
  });
  it("clamps lag to 0..6h", () => {
    expect(clampLag(-5)).toBe(0);
    expect(clampLag(MAX_LAG_MS + 1)).toBe(MAX_LAG_MS);
    expect(clampLag(NaN)).toBe(0);
  });
});

describe("ordering", () => {
  it("sorts by matchTime, then server time, then id", () => {
    const a = msg({ id: "a", sentTime: 100, lag: 0 }); // match 100
    const b = msg({ id: "b", sentTime: 150, lag: 60 }); // match 90
    const c = msg({ id: "c", sentTime: 120, lag: 20 }); // match 100, later sent
    const d = msg({ id: "d", sentTime: 120, lag: 20 }); // tie with c, by id
    expect([a, b, d, c].sort(compareMsgs).map((m) => m.id)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("RoomStore", () => {
  let now = 0;
  const clock = () => now;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000_000;
  });
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };

  it("shows my own messages instantly", () => {
    const s = new RoomStore("me", 60_000, clock);
    s.add([msg({ id: "x", senderId: "me", sentTime: now })]);
    expect(s.view()[0].locked).toBe(false);
  });

  it("locks then reveals on schedule, with one timer", () => {
    const onRevealed = vi.fn();
    const onLocked = vi.fn();
    const s = new RoomStore("me", 25_000, clock, { onRevealed, onLocked });
    s.add([msg({ id: "a", sentTime: now }), msg({ id: "b", sentTime: now + 1_000 })]);
    expect(onLocked).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    expect(s.view().every((v) => v.locked)).toBe(true);
    advance(25_000);
    expect(s.view().map((v) => v.locked)).toEqual([false, true]);
    expect(onRevealed).toHaveBeenLastCalledWith([expect.objectContaining({ id: "a" })], "schedule");
    advance(1_000);
    expect(s.lockedCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never puts locked content in the view", () => {
    const s = new RoomStore("me", 25_000, clock);
    s.add([msg({ id: "a", sentTime: now, text: "Kohli OUT" })]);
    const v = s.view()[0];
    expect(v.locked).toBe(true);
    expect(v.text).toBeUndefined();
    expect(JSON.stringify(s.view())).not.toContain("Kohli");
  });

  it("applies a lag change during a countdown immediately; revealed stays revealed", () => {
    const s = new RoomStore("me", 30_000, clock);
    s.add([msg({ id: "a", sentTime: now }), msg({ id: "b", sentTime: now + 20_000 })]);
    advance(10_000);
    s.setLag(5_000); // a: revealAt now-10s+5s -> due; b: still in the future
    expect(s.view().map((v) => v.locked)).toEqual([false, true]);
    s.setLag(60_000); // a must not re-lock
    expect(s.isRevealed("a")).toBe(true);
    advance(14_999);
    expect(s.isRevealed("b")).toBe(false);
    advance(60_000);
    expect(s.isRevealed("b")).toBe(true);
  });

  it("spoil me reveals one message; reveal all reveals the rest", () => {
    const onRevealed = vi.fn();
    const s = new RoomStore("me", 60_000, clock, { onRevealed });
    s.add([msg({ id: "a", sentTime: now }), msg({ id: "b", sentTime: now }), msg({ id: "c", sentTime: now })]);
    s.spoil("b");
    expect(s.view().map((v) => v.locked)).toEqual([true, false, true]);
    expect(s.view()[1].spoiled).toBe(true);
    expect(onRevealed).toHaveBeenLastCalledWith([expect.objectContaining({ id: "b" })], "spoil");
    s.spoilAll();
    expect(s.lockedCount()).toBe(0);
    // Scheduled timers firing later must not double-reveal.
    onRevealed.mockClear();
    advance(60_000);
    expect(onRevealed).not.toHaveBeenCalled();
  });

  it("pause grows my lag 1ms per ms and keeps it on resume", () => {
    const s = new RoomStore("me", 10_000, clock);
    s.add([msg({ id: "a", sentTime: now + 5_000 })]); // reveals at now+15s if not paused
    s.pause();
    advance(60_000);
    expect(s.effectiveLag()).toBe(70_000);
    expect(s.isRevealed("a")).toBe(false);
    s.resume();
    expect(s.effectiveLag()).toBe(70_000);
    advance(14_999);
    expect(s.isRevealed("a")).toBe(false);
    advance(1);
    expect(s.isRevealed("a")).toBe(true);
  });

  it("dedupes by id", () => {
    const onLocked = vi.fn();
    const s = new RoomStore("me", 10_000, clock, { onLocked });
    s.add([msg({ id: "a", sentTime: now })]);
    s.add([msg({ id: "a", sentTime: now }), msg({ id: "a", sentTime: now })]);
    expect(s.view()).toHaveLength(1);
    expect(onLocked).toHaveBeenCalledTimes(1);
  });

  it("history: old messages are already visible", () => {
    const s = new RoomStore("me", 25_000, clock);
    s.add([msg({ id: "old", sentTime: now - 3_600_000 })]);
    expect(s.view()[0].locked).toBe(false);
  });

  it("recomputes when the clock offset changes", () => {
    let offset = 0;
    const s = new RoomStore("me", 25_000, () => now + offset);
    s.add([msg({ id: "a", sentTime: now })]);
    offset = 30_000;
    s.clockChanged();
    expect(s.isRevealed("a")).toBe(true);
  });

  it("only text messages render as bubbles", () => {
    const s = new RoomStore("me", 0, clock);
    s.add([msg({ id: "r", kind: "roar", text: undefined, payload: { intensity: 3 } })]);
    expect(s.view()).toHaveLength(0);
    expect(s.all()).toHaveLength(1);
  });
});

describe("clock offset", () => {
  it("offset = ts - (t0 + t1) / 2", () => {
    expect(offsetOf({ t0: 1000, ts: 5100, t1: 1200 })).toBe(4000);
  });
  it("median of samples resists an outlier", () => {
    const samples = [4000, 4010, 3990, 9000, 4005].map((o) => ({ t0: 0, ts: o + 50, t1: 100 }));
    expect(estimateOffset(samples)).toBe(4005);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("measureOffset takes n samples and skips failures", async () => {
    let local = 0;
    let calls = 0;
    const fetchTime = async () => {
      calls++;
      if (calls === 2) throw new Error("net");
      local += 100;
      return local + 5000 - 50;
    };
    const off = await measureOffset(fetchTime, 5, () => local);
    expect(calls).toBe(5);
    // ts = t1 + 4950 and t0 = t1 - 100, so offset = 4950 + 50.
    expect(off).toBe(5000);
  });
});

describe("wire parsing", () => {
  const raw = (p: Partial<RawMsg>): RawMsg => ({ id: "m1", type: "RC:TxtMsg", senderId: "u1", sentTime: 1000, content: {}, ...p });

  it("parses a stamped text message", () => {
    const m = parseIncoming(raw({ content: { text: "hi", extra: encodeTextExtra(25_000, "Asha", "🦊") } }))!;
    expect(m).toMatchObject({ kind: "text", text: "hi", lag: 25_000, senderName: "Asha", avatar: "🦊" });
  });
  it("server-sent text uses `content` for the body", () => {
    const m = parseIncoming(raw({ content: { content: "bot hi", extra: encodeTextExtra(0, "Arjun", "📺") } }))!;
    expect(m.text).toBe("bot hi");
  });
  it("malformed stamp shows as a normal, never-locked message", () => {
    for (const extra of [undefined, "", "{not json", '{"sb":2,"lag":5}', '{"sb":1,"lag":"x"}']) {
      const m = parseIncoming(raw({ content: { text: "hi", extra } }))!;
      expect(m.lag).toBeNull();
      expect(isLocked(m, "me", 60_000, 0)).toBe(false);
    }
  });
  it("parses valid SB:Roar and drops malformed or unknown types", () => {
    const ok = parseIncoming(raw({ type: SB_TYPES.roar, content: { v: 1, lag: 3000, intensity: 2, dur: 1500 } }));
    expect(ok).toMatchObject({ kind: "roar", lag: 3000 });
    expect(parseIncoming(raw({ type: SB_TYPES.roar, content: { v: 1, lag: 3000, intensity: 9 } }))).toBeNull();
    expect(parseIncoming(raw({ type: "RC:ImgMsg" }))).toBeNull();
    expect(parseIncoming(raw({ sentTime: NaN, content: { text: "x" } }))).toBeNull();
  });
});

describe("MinHeap", () => {
  it("pops in ascending order", () => {
    const h = new MinHeap();
    [5, 1, 4, 2, 3, 0].forEach((at, i) => h.push({ id: String(i), at }));
    const out: number[] = [];
    while (h.size) out.push(h.pop()!.at);
    expect(out).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
