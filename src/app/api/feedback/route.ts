import { sql } from "drizzle-orm";
import { FeedbackReq } from "@/lib/api-schemas";
import { checkKey } from "@/lib/auth";
import { db, events, feedback } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail } from "@/lib/http";

export async function POST(req: Request) {
  if (!rateLimit(`feedback:${clientIp(req)}`, 10, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, FeedbackReq);
  if (b instanceof Response) return b;
  if (!checkKey(b.guestId, b.key)) return fail(401, "bad_key");
  const survey = b.spoiled !== undefined || b.again !== undefined;
  try {
    if (survey)
      await db()
        .insert(feedback)
        .values({ userId: b.guestId, roomCode: b.roomCode ?? null, helpful: b.helpful, comment: b.comment || null, spoiled: b.spoiled ?? null, again: b.again ?? null });
    // Plain insert naming only the original columns, so the 20-minute prompt works even before migration 0005.
    else await db().execute(sql`insert into feedback (user_id, room_code, helpful, comment) values (${b.guestId}, ${b.roomCode ?? null}, ${b.helpful}, ${b.comment || null})`);
  } catch (e) {
    console.error("feedback failed", (e as Error).message);
    return fail(500, "error");
  }
  await db()
    .insert(events)
    .values({ name: survey ? "survey" : "feedback", userId: b.guestId, roomCode: b.roomCode ?? null, props: survey ? { spoiled: !!b.spoiled, again: !!b.again } : { helpful: b.helpful } });
  return new Response(null, { status: 204 });
}
