import { and, eq } from "drizzle-orm";
import { ModerateReq } from "@/lib/api-schemas";
import { checkKey } from "@/lib/auth";
import { db, roomMembers } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { leaveGroup, muteInGroup } from "@/lib/nexconn-server";
import { getRoom } from "@/lib/rooms";

const MUTE_MINUTES = 60;

// The room creator can mute (1 hour) or remove members, through the Nexconn Server API.
export async function POST(req: Request) {
  if (!rateLimit(`moderate:${clientIp(req)}`, 20, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, ModerateReq);
  if (b instanceof Response) return b;
  if (!checkKey(b.guestId, b.key)) return fail(401, "bad_key");
  const room = await getRoom(b.code);
  if (!room) return fail(404, "room_not_found");
  if (room.createdBy !== b.guestId) return fail(403, "not_owner");
  if (b.targetId === b.guestId || b.targetId.startsWith("bot_")) return fail(400, "invalid_request");
  try {
    if (b.action === "mute") {
      await muteInGroup(room.channelId, b.targetId, MUTE_MINUTES);
    } else {
      await db()
        .update(roomMembers)
        .set({ removedAt: new Date() })
        .where(and(eq(roomMembers.roomCode, room.code), eq(roomMembers.userId, b.targetId)));
      await leaveGroup(room.channelId, b.targetId);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("moderate failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
