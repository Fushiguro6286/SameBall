// Small server-side guards: rate limiting, profanity, ids.

// shortcut: in-memory per-instance limiter, a speed bump not a security boundary. Move to Redis/Upstash if abused.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// shortcut: tiny blocklist; Nexconn's Console profanity filter covers chat messages.
export { isProfane } from "./profanity";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomCode(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export const GUEST_ID_RE = /^g_[A-Za-z0-9]{20}$/;
export function newGuestId(): string {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return "g_" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => a[b % a.length]).join("");
}
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
