import { eq } from "drizzle-orm";
import { TryReq } from "@/lib/api-schemas";
import { AVATARS } from "@/lib/config";
import { db, profiles } from "@/lib/db";
import { clientIp, isProfane, newGuestId, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { createTryRoom } from "@/lib/try";

// Judge Mode: one tap creates a private demo room with the visitor and two bot friends.
export async function POST(req: Request) {
  if (!rateLimit(`try:${clientIp(req)}`, 6, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, TryReq);
  if (b instanceof Response) return b;
  if (b.name && isProfane(b.name)) return fail(400, "name_not_allowed");
  try {
    let guestId = b.guestId;
    const existing = guestId ? (await db().select().from(profiles).where(eq(profiles.id, guestId)).limit(1))[0] : undefined;
    const name = existing?.name ?? b.name ?? "Guest";
    const avatar = existing?.avatar ?? b.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)];
    if (!existing) {
      guestId = newGuestId();
      await db().insert(profiles).values({ id: guestId, name, avatar, isTest: !!b.test });
    } else if (existing.isBot) {
      return fail(400, "invalid_request");
    }
    const room = await createTryRoom(guestId!);
    return json({ guestId, name, avatar, code: room.code });
  } catch (e) {
    console.error("try failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
