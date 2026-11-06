import { eq } from "drizzle-orm";
import { CreateRoomReq } from "@/lib/api-schemas";
import { checkKey } from "@/lib/auth";
import { db, profiles } from "@/lib/db";
import { clientIp, isProfane, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { FEATURES } from "@/lib/config";
import { createRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  if (!rateLimit(`rooms:${clientIp(req)}`, 10, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, CreateRoomReq);
  if (b instanceof Response) return b;
  if (!checkKey(b.guestId, b.key)) return fail(401, "bad_key");
  if (isProfane(b.roomName)) return fail(400, "name_not_allowed");
  const startsAt = b.startsAt ? new Date(b.startsAt) : undefined;
  if (startsAt && (startsAt.getTime() < Date.now() - 60 * 60_000 || startsAt.getTime() > Date.now() + 60 * 86_400_000)) {
    return fail(400, "invalid_request");
  }
  const [owner] = await db().select({ id: profiles.id }).from(profiles).where(eq(profiles.id, b.guestId)).limit(1);
  if (!owner) return fail(401, "no_session");
  try {
    const room = await createRoom({ name: b.roomName, sport: b.sport, owner: b.guestId, startsAt, kind: b.creator && FEATURES.creatorRooms ? "creator" : "room" });
    return json({ code: room.code, channelId: room.channelId, name: room.name, sport: room.sport });
  } catch (e) {
    console.error("create room failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
