import { ClientErrorReq } from "@/lib/api-schemas";
import { clientIp, rateLimit } from "@/lib/guard";
import { body, fail } from "@/lib/http";

// Logs client crashes to the server log (Vercel runtime logs).
export async function POST(req: Request) {
  if (!rateLimit(`err:${clientIp(req)}`, 20, 60_000)) return fail(429, "rate_limited");
  const b = await body(req, ClientErrorReq);
  if (b instanceof Response) return b;
  console.error("[client-error]", b.url ?? "", b.message, b.stack?.split("\n").slice(0, 6).join(" | ") ?? "");
  return new Response(null, { status: 204 });
}
