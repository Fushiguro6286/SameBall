import { describe, expect, it } from "vitest";
import { lagOf, parseWebhook } from "./webhook";

const item = (p: Record<string, unknown> = {}) => ({
  userId: "g_A",
  channelId: "sbABC234",
  channelType: 3,
  messageType: "RC:TxtMsg",
  content: JSON.stringify({ content: "SIX!", extra: JSON.stringify({ sb: 1, lag: 25000 }) }),
  messageId: "m1",
  time: 1_730_192_400_000,
  os: "Websocket",
  ...p,
});

describe("Nexconn webhook parsing", () => {
  it("reads the docs' message:send shape, including the lag stamp", () => {
    const rows = parseWebhook({ type: "message:send", id: "e1", time: 1, data: [item()] });
    expect(rows).toEqual([{ messageId: "m1", userId: "g_A", channelId: "sbABC234", messageType: "RC:TxtMsg", lag: 25000, sentAt: new Date(1_730_192_400_000) }]);
  });
  it("reads lag from custom SB:* content", () => {
    expect(lagOf("SB:Roar", JSON.stringify({ v: 1, lag: 8000, intensity: 3, dur: 1500 }))).toBe(8000);
  });
  it("text without a stamp still counts, with lag null", () => {
    expect(parseWebhook({ type: "message:send", data: [item({ content: JSON.stringify({ content: "hi", extra: "" }) })] })[0].lag).toBeNull();
  });
  it("skips other events, non-group channels, foreign types and malformed items", () => {
    expect(parseWebhook({ type: "user:connection_status", data: [item()] })).toEqual([]);
    expect(parseWebhook({ type: "message:send", data: [item({ channelType: 1 }), item({ messageType: "RC:ImgMsg" }), { junk: true }] })).toEqual([]);
    expect(parseWebhook("nope")).toEqual([]);
  });
});
