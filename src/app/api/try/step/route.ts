import { TryStepReq } from "@/lib/api-schemas";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";
import { sendTryStep } from "@/lib/try";
import { TRY_STEPS } from "@/lib/try-script";
import { loadTryRoom } from "../load";

// Idempotent: each scripted bot step is sent once, validated against the script and its time.
export async function POST(req: Request) {
  if (!rateLimit(`try-step:${clientIp(req)}`, 120, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, TryStepReq);
  if (b instanceof Response) return b;
  if (b.step >= TRY_STEPS.length) return fail(400, "invalid_request");
  try {
    const room = await loadTryRoom(b.code, b.guestId);
    if (room instanceof Response) return room;
    const r = await sendTryStep(room, b.step);
    return r === "early" ? fail(425, "too_early") : json({ ok: true, result: r });
  } catch (e) {
    console.error("try step failed", (e as Error).message);
    return fail(502, "chat_unavailable");
  }
}
