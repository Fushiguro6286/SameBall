import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("guest keys", () => {
  beforeAll(() => {
    process.env.NEXCONN_APP_SECRET = "test-secret";
  });
  it("accepts the key issued for that guest only", async () => {
    const { checkKey, guestKey } = await import("./auth");
    const k = guestKey("g_AAAAAAAAAAAAAAAAAAAA");
    expect(k).toHaveLength(32);
    expect(checkKey("g_AAAAAAAAAAAAAAAAAAAA", k)).toBe(true);
    expect(checkKey("g_BBBBBBBBBBBBBBBBBBBB", k)).toBe(false);
    expect(checkKey("g_AAAAAAAAAAAAAAAAAAAA", k.slice(0, -1) + (k.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(checkKey("g_AAAAAAAAAAAAAAAAAAAA", undefined)).toBe(false);
    expect(checkKey("g_AAAAAAAAAAAAAAAAAAAA", "short")).toBe(false);
  });
});
