import { sql } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/guard";
import { fail } from "@/lib/http";
import { getDays, toCsv } from "@/lib/stats";

const csvCell = (v: unknown) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** End-of-match survey answers from real users (needs migration 0005). */
async function surveyCsv(): Promise<string> {
  const res = await db().execute(sql`
    select to_char(f.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as at, f.room_code, f.spoiled, f.again, f.comment
    from feedback f join profiles p on p.id = f.user_id
    where (f.spoiled is not null or f.again is not null) and not p.is_test and not p.is_bot
    order by f.created_at
  `);
  const rows = res.rows as Record<string, unknown>[];
  return ["time_ist,room,spoiled,would_use_again,comment", ...rows.map((r) => [r.at, r.room_code, r.spoiled, r.again, r.comment].map(csvCell).join(","))].join("\n") + "\n";
}

// Daily real usage (default) or survey answers (?type=survey) as CSV, for the traction proof. Bearer ADMIN_TOKEN.
export async function GET(req: Request) {
  if (!rateLimit(`admin:${clientIp(req)}`, 30, 60_000)) return fail(429, "rate_limited");
  if (!isAdmin(req)) return fail(401, "unauthorized");
  const survey = new URL(req.url).searchParams.get("type") === "survey";
  try {
    const csv = survey ? await surveyCsv() : toCsv(await getDays());
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sameball-${survey ? "survey" : "daily"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export failed", (e as Error).message);
    return fail(500, "error");
  }
}
