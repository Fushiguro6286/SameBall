import { describe, expect, it } from "vitest";
import { isProfane, maskProfanity } from "./profanity";

describe("profanity", () => {
  it("catches English, Hinglish, leetspeak, stretched letters and Devanagari", () => {
    for (const s of ["what the fuck", "chutiya umpire", "sh1t", "fuuuck", "ये अंपायर चूतिया है", "हरामियों"]) expect(isProfane(s)).toBe(true);
  });
  it("leaves normal words and names alone", () => {
    for (const s of ["Ashit", "Dickens", "What a catch!", "छक्का!!", "Scunthorpe", "class act"]) expect(isProfane(s)).toBe(false);
  });
  it("masks only the bad word, keeping its first letter", () => {
    expect(maskProfanity("what a gandu shot!")).toBe("what a g★★★★ shot!");
    expect(maskProfanity("Kya shot hai!")).toBe("Kya shot hai!");
    expect(maskProfanity("ये रंडी")).toMatch(/^ये र★+$/);
  });
});
