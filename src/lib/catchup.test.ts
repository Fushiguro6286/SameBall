import { describe, expect, it } from "vitest";
import { CATCHUP_SYSTEM, catchupPrompt, guardBullets, misattributes, parseBullets, revealedOnly, type CatchupMsg } from "./catchup";
import { TRY_ANCHOR_LABEL, TRY_BOTS, TRY_STEPS } from "./try-script";

describe("catch-up spoiler rule", () => {
  it("keeps only messages whose moment has reached my screen, oldest first", () => {
    const now = 1_000_000;
    const msgs = [
      { name: "A", text: "later", matchTime: now - 10_000 }, // reveals for me (lag 25 s) at now + 15 s
      { name: "B", text: "seen", matchTime: now - 30_000 },
      { name: "C", text: "just now", matchTime: now - 26_000 },
    ];
    expect(revealedOnly(msgs, 25_000, now).map((m) => m.text)).toEqual(["seen", "just now"]);
  });
});

describe("prompt and parsing", () => {
  it("puts each message on its own line with the sender's name", () => {
    expect(catchupPrompt([{ name: "Arjun", text: "SIX!\n🔥", matchTime: 0 }])).toContain("[Arjun, viewer] SIX! 🔥");
  });

  it("strips markers, bold and intro lines, keeps at most 3", () => {
    expect(parseBullets("Here you go:\n- **Arjun** called a six\n* Meera doubted DRS\n• Priya panicked\n4. extra")).toEqual([
      "Arjun called a six",
      "Meera doubted DRS",
      "Priya panicked",
    ]);
    expect(parseBullets("No markers here\nSecond line")).toEqual(["No markers here", "Second line"]);
    expect(parseBullets("1) one\n2) two")).toEqual(["one", "two"]);
  });
});

describe("viewers are never players (Judge Mode script)", () => {
  // The demo chat as the catch-up sees it: bot friends on the fastest feed plus the First ball marker.
  const demo: CatchupMsg[] = [
    { name: "match", text: TRY_ANCHOR_LABEL, matchTime: 0, event: true },
    ...TRY_STEPS.flatMap((s) => (s.kind === "text" ? [{ name: TRY_BOTS[s.bot].name, text: s.text, matchTime: s.t * 1000, lagS: 0 }] : [])),
  ];
  const names = Object.values(TRY_BOTS).map((b) => b.name);

  it("tells the model who the viewers are and marks match markers", () => {
    const p = catchupPrompt(demo);
    expect(p).toContain("Friends in this chat (viewers, not players): Arjun (feed 0s behind live), Meera (feed 0s behind live)");
    expect(p).toContain("[match marker] First ball");
    expect(p).toContain("[Meera, viewer] WHAT A HIT!!! INTO THE STANDS 🔥🔥");
    expect(CATCHUP_SYSTEM).toMatch(/never players/);
  });

  it("flags bullets where a friend is the subject of a batting or bowling verb", () => {
    for (const bad of ["Arjun hits a four, a six", "Meera bowls a dot ball", "arjun smashed it into the stands", "Then Meera's caught out", "Arjun then scores the winning runs"])
      expect(misattributes(bad, names), bad).toBe(true);
    for (const ok of ["A six went into the stands and Arjun went wild", "Meera groaned at the wicket", "Arjun called the six before it landed", "The batter hits a four; Meera cheered"])
      expect(misattributes(ok, names), ok).toBe(false);
  });

  it("drops misattributed bullets and keeps the rest", () => {
    const out = guardBullets(["Arjun hits a four, a six", "A six sailed into the stands; Meera roared", "The over ended with a winning FOUR"], demo);
    expect(out).toEqual(["A six sailed into the stands; Meera roared", "The over ended with a winning FOUR"]);
    for (const b of out) expect(misattributes(b, names)).toBe(false);
  });
});
