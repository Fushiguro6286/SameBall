import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile } from "./calendar";

const start = Date.UTC(2026, 10, 20, 14, 0, 0);

describe("calendar", () => {
  it("Google link carries UTC start/end stamps", () => {
    const u = new URL(googleCalendarUrl("Final, Day 2", start, "https://x.test/r/ABC234"));
    expect(u.searchParams.get("dates")).toBe("20261120T140000Z/20261120T170000Z");
    expect(u.searchParams.get("text")).toBe("Final, Day 2");
  });
  it(".ics escapes commas and uses CRLF lines", () => {
    const ics = icsFile("Final, Day 2", start, "https://x.test/r/ABC234", "ABC234");
    expect(ics).toContain("SUMMARY:Final\\, Day 2\r\n");
    expect(ics).toContain("DTSTART:20261120T140000Z");
  });
});
