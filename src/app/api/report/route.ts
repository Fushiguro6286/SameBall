import { ReportReq } from "@/lib/api-schemas";
import { checkKey } from "@/lib/auth";
import { db, reports } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { isMember } from "@/lib/rooms";

// Members can report anyone in their room. Reports are reviewed by hand.
export async function POST(req: Request) {
  if (!rateLimit(`report:${clientIp(req)}`, 10, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, ReportReq);
  if (b instanceof Response) return b;
  if (!checkKey(b.guestId, b.key)) return fail(401, "bad_key");
  if (!(await isMember(b.code, b.guestId))) return fail(403, "not_member");
  await db().insert(reports).values({ reporterId: b.guestId, targetId: b.targetId, roomCode: b.code, reason: b.reason || null });
  return json({ ok: true });
}
