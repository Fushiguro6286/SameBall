import { eq } from "drizzle-orm";
import { MetricsReq } from "@/lib/api-schemas";
import { db, events, profiles } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail } from "@/lib/http";

export async function POST(req: Request) {
  if (!rateLimit(`metrics:${clientIp(req)}`, 120, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, MetricsReq);
  if (b instanceof Response) return b;
  let isTest = false;
  if (b.guestId) {
    const [p] = await db().select({ t: profiles.isTest, bot: profiles.isBot }).from(profiles).where(eq(profiles.id, b.guestId)).limit(1);
    isTest = !!(p?.t || p?.bot);
  }
  await db()
    .insert(events)
    .values(b.events.map((e) => ({ name: e.name, userId: b.guestId ?? null, roomCode: e.roomCode ?? null, props: e.props ?? null, isTest })));
  return new Response(null, { status: 204 });
}
