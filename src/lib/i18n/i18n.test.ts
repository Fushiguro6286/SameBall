import { describe, expect, it } from "vitest";
import { en } from "./en";
import { hi } from "./hi";
import { setLang, subscribeLang, t, textAt } from "./index";

/** Every key path, with arrays expanded, so a missing or extra entry shows up by name. */
function shape(o: unknown, p = ""): string[] {
  if (typeof o === "function") return [`${p}()`];
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => shape(v, p ? `${p}.${k}` : k));
  return [p];
}

describe("i18n", () => {
  it("Hindi has exactly the English keys", () => {
    expect(shape(hi)).toEqual(shape(en));
  });

  it("Hindi functions return text for sample arguments", () => {
    expect(hi.room.unlocksIn(75)).toBe("1m 15s में खुलेगा");
    expect(hi.try.need(14, 6)).toContain("14");
    expect(hi.try.result("W")).toBe("आउट!");
    expect(hi.schedule.startsIn(90 * 60_000)).toBe("1h 30m में शुरू");
  });

  it("textAt reads nested and array paths", () => {
    expect(textAt(hi, "landing.heroTitle")).toBe(hi.landing.heroTitle);
    expect(textAt(en, "landing.steps.1.title")).toBe("Pick your feed");
  });

  it("setLang swaps the live binding and notifies subscribers", () => {
    let calls = 0;
    const off = subscribeLang(() => calls++);
    setLang("hi");
    expect(t.room.send).toBe("भेजें");
    setLang("hi");
    setLang("en");
    expect(t.room.send).toBe("Send");
    expect(calls).toBe(2);
    off();
  });
});
