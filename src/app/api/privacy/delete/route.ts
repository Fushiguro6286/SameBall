import { eq } from "drizzle-orm";
import { DeleteDataReq } from "@/lib/api-schemas";
import { db, events, feedback, profiles, roomMembers } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail } from "@/lib/http";

// Deletes everything we store about a guest. Chat messages live in Nexconn and expire there.
export async function POST(req: Request) {
  if (!rateLimit(`delete:${clientIp(req)}`, 5, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, DeleteDataReq);
  if (b instanceof Response) return b;
  const d = db();
  await d.delete(events).where(eq(events.userId, b.guestId));
  await d.delete(feedback).where(eq(feedback.userId, b.guestId));
  await d.delete(roomMembers).where(eq(roomMembers.userId, b.guestId));
  await d.delete(profiles).where(eq(profiles.id, b.guestId));
  return new Response(null, { status: 204 });
}
