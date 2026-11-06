import { AiError, aiConfig, chat } from "@/lib/ai";
import { CatchupReq } from "@/lib/api-schemas";
import { checkKey } from "@/lib/auth";
import { CATCHUP_SYSTEM, catchupPrompt, guardBullets, parseBullets, revealedOnly } from "@/lib/catchup";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail, json } from "@/lib/http";

const MIN_MSGS = 3;

export async function POST(req: Request) {
  if (!aiConfig()) return fail(501, "not_configured");
  if (!rateLimit(`catchup-ip:${clientIp(req)}`, 20, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, CatchupReq);
  if (b instanceof Response) return b;
  if (!checkKey(b.guestId, b.key)) return fail(401, "bad_key");
  if (!rateLimit(`catchup:${b.guestId}`, 5, 60_000)) return fail(429, "rate_limited");

  // The client already filtered to revealed messages; check again here with the lag it sent.
  const msgs = revealedOnly(b.msgs, b.lag, Date.now());
  if (msgs.filter((m) => !m.event).length < MIN_MSGS) return json({ bullets: [] });
  try {
    // Drop any bullet that turns a friend into a player ("Arjun hits a six").
    const bullets = guardBullets(parseBullets(await chat(CATCHUP_SYSTEM, catchupPrompt(msgs))), msgs);
    if (!bullets.length) return fail(502, "ai_failed");
    return json({ bullets });
  } catch (e) {
    console.warn("catchup failed", e instanceof AiError ? e.message : e);
    return fail(502, "ai_failed");
  }
}
