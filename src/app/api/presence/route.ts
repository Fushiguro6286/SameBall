import { and, eq, gt, sql } from "drizzle-orm";
import { TryActionReq } from "@/lib/api-schemas";
import { db, roomMembers } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";

const WINDOW_MS = 75_000; // clients beat every 30 s

// "Watching now": Nexconn has no channel presence, so members heartbeat here and we count recent beats.
export async function POST(req: Request) {
  if (!rateLimit(`presence:${clientIp(req)}`, 30, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, TryActionReq);
  if (b instanceof Response) return b;
  try {
    const beat = await db()
      .update(roomMembers)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(roomMembers.roomCode, b.code), eq(roomMembers.userId, b.guestId)))
      .returning({ u: roomMembers.userId });
    if (!beat.length) return fail(403, "not_member");
    const [row] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomCode, b.code), gt(roomMembers.lastSeenAt, new Date(Date.now() - WINDOW_MS))));
    return json({ watching: row?.n ?? 1 });
  } catch (e) {
    console.error("presence failed", (e as Error).message);
    return fail(500, "error");
  }
}
