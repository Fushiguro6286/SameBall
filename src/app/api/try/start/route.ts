import { TryActionReq } from "@/lib/api-schemas";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { startTry } from "@/lib/try";
import { loadTryRoom } from "../load";

export async function POST(req: Request) {
  if (!rateLimit(`try-start:${clientIp(req)}`, 20, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, TryActionReq);
  if (b instanceof Response) return b;
  try {
    const room = await loadTryRoom(b.code, b.guestId);
    if (room instanceof Response) return room;
    await startTry(room);
    return json({ ok: true });
  } catch (e) {
    console.error("try start failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
