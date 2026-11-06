import { desc, eq } from "drizzle-orm";
import { postAnchor, isAdmin } from "@/lib/admin";
import { AdminReq } from "@/lib/api-schemas";
import { db, rooms } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { getRoom } from "@/lib/rooms";

const guard = (req: Request) =>
  !rateLimit(`admin:${clientIp(req)}`, 30, 60_000) ? fail(429, "rate_limited") : !isAdmin(req) ? fail(401, "unauthorized") : null;

export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const list = await db()
    .select({ code: rooms.code, name: rooms.name, sport: rooms.sport, members: rooms.memberCount, featured: rooms.featured, startsAt: rooms.startsAt, createdAt: rooms.createdAt })
    .from(rooms)
    .where(eq(rooms.kind, "room"))
    .orderBy(desc(rooms.createdAt))
    .limit(100);
  return json({ rooms: list });
}

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const b = await body(req, AdminReq);
  if (b instanceof Response) return b;
  const room = await getRoom(b.code);
  if (!room || room.kind !== "room") return fail(404, "room_not_found");
  try {
    if (b.action === "feature") await db().update(rooms).set({ featured: b.featured }).where(eq(rooms.code, b.code));
    else await postAnchor(room, b.label, Math.round(b.lagS * 1000));
    return json({ ok: true });
  } catch (e) {
    console.error("admin action failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
