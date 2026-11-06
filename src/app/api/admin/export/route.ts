import { isAdmin } from "@/lib/admin";
import { clientIp, rateLimit } from "@/lib/guard";
import { fail } from "@/lib/http";
import { getDays, toCsv } from "@/lib/stats";

// Daily real usage as CSV for the traction screenshots. Bearer ADMIN_TOKEN.
export async function GET(req: Request) {
  if (!rateLimit(`admin:${clientIp(req)}`, 30, 60_000)) return fail(429, "rate_limited");
  if (!isAdmin(req)) return fail(401, "unauthorized");
  const csv = toCsv(await getDays());
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sameball-daily.csv"', "Cache-Control": "no-store" },
  });
}
