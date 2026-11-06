import { describe, expect, it } from "vitest";
import { catchupPrompt, parseBullets, revealedOnly } from "./catchup";

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
    expect(catchupPrompt([{ name: "Arjun", text: "SIX!\n🔥", matchTime: 0 }])).toContain("[Arjun] SIX! 🔥");
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
