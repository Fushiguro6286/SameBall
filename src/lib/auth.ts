import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Guest ids are public (they're Nexconn sender ids and appear in invite links), so they can't be the credential.
// The server gives each guest a key = HMAC(app secret, id). No storage needed to check it.

function secret(): string {
  const s = process.env.NEXCONN_APP_SECRET;
  if (!s) throw new Error("NEXCONN_APP_SECRET is not set");
  return s;
}

export const guestKey = (guestId: string) => createHmac("sha256", secret()).update(`sb-guest:${guestId}`).digest("base64url").slice(0, 32);

export function checkKey(guestId: string, key: string | undefined): boolean {
  if (!key) return false;
  const a = Buffer.from(guestKey(guestId));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
