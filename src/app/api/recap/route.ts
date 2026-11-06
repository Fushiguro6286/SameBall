import { ROOM_CODE_RE, clientIp, rateLimit } from "@/lib/guard";
import { fail, json } from "@/lib/http";
import { getRecap } from "@/lib/recap";

// Squad recap numbers (counts and names only, same as the public /r/CODE/recap page).
export async function GET(req: Request) {
  if (!rateLimit(`recap:${clientIp(req)}`, 30, 60_000)) return fail(429, "rate_limited");
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!ROOM_CODE_RE.test(code)) return fail(400, "bad_code");
  const r = await getRecap(code).catch((e) => (console.error("recap failed", (e as Error).message), undefined));
  if (r === undefined) return fail(500, "error");
  if (!r) return fail(404, "room_not_found");
  return json(r);
}
