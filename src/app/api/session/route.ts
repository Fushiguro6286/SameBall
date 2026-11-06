import { eq } from "drizzle-orm";
import { SessionReq } from "@/lib/api-schemas";
import { checkKey, guestKey } from "@/lib/auth";
import { db, profiles } from "@/lib/db";
import { clientIp, isProfane, newGuestId, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { clientConfig, issueToken } from "@/lib/nexconn-server";
import { joinRoom } from "@/lib/rooms";

// Creates or reuses a guest, issues a Nexconn token and (optionally) joins a room.
export async function POST(req: Request) {
  if (!rateLimit(`session:${clientIp(req)}`, 30, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, SessionReq);
  if (b instanceof Response) return b;
  if (isProfane(b.name)) return fail(400, "name_not_allowed");

  const guestId = b.guestId ?? newGuestId();
  try {
    if (b.guestId) {
      // Reusing a guest needs its key, unless it predates keys (it gets one now).
      const [p] = await db().select({ keyed: profiles.keyed }).from(profiles).where(eq(profiles.id, guestId)).limit(1);
      if (p?.keyed && !checkKey(guestId, b.key)) return fail(401, "bad_key");
    }
    await db()
      .insert(profiles)
      .values({ id: guestId, name: b.name, avatar: b.avatar, referrer: b.ref && b.ref !== guestId ? b.ref : null, isTest: !!b.test, keyed: true })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { name: b.name, avatar: b.avatar, lastSeenAt: new Date(), keyed: true, ...(b.test ? { isTest: true } : {}) },
      });
    const [token, room] = await Promise.all([
      issueToken(guestId, b.name),
      b.roomCode
        ? joinRoom(b.roomCode, guestId).catch((e: Error) =>
            e.message === "room not found" ? null : e.message === "removed" ? ("removed" as const) : Promise.reject(e),
          )
        : undefined,
    ]);
    if (room === null) return fail(404, "room_not_found");
    if (room === "removed") return fail(403, "removed");
    return json({
      guestId,
      key: guestKey(guestId),
      token,
      ...clientConfig(),
      room: room && {
        code: room.code,
        channelId: room.channelId,
        name: room.name,
        sport: room.sport,
        ...(b.roomCode && room.code !== b.roomCode ? { redirectedFrom: b.roomCode } : {}),
      },
    });
  } catch (e) {
    console.error("session failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
