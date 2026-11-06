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
  await db().insert(feedback).values({ userId: b.guestId, roomCode: b.roomCode ?? null, helpful: b.helpful, comment: b.comment || null });
  await db().insert(events).values({ name: "feedback", userId: b.guestId, roomCode: b.roomCode ?? null, props: { helpful: b.helpful } });
  return new Response(null, { status: 204 });
}
