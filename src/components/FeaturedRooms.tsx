import Link from "next/link";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, rooms } from "@/lib/db";
import { t } from "@/lib/i18n";

/** Featured rooms (set in /admin), so new visitors can drop straight into a live match room. */
async function loadFeatured() {
  const list = await db()
    .select({ code: rooms.code, name: rooms.name, sport: rooms.sport, kind: rooms.kind, startsAt: rooms.startsAt })
    .from(rooms)
    .where(and(eq(rooms.featured, true), inArray(rooms.kind, ["room", "stadium"])))
    .orderBy(sql`${rooms.startsAt} asc nulls first`, asc(rooms.createdAt))
    .limit(6)
    .catch(() => []);
  return { list, now: Date.now() };
}

export async function FeaturedRooms() {
  await connection();
  const { list, now } = await loadFeatured();
  if (!list.length) return null;
  return (
    <section aria-labelledby="featured" className="w-full">
      <h2 id="featured" className="mb-3 font-display text-3xl">
        {t.featured.title}
      </h2>
      <ul className="grid gap-2">
        {list.map((r) => {
          const live = !r.startsAt || r.startsAt.getTime() <= now;
          return (
            <li key={r.code}>
              <Link href={`/r/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="text-sm text-muted">
                    {r.kind === "stadium" && `${t.stadium.badge} · `}
                    {t.sports[r.sport] ?? r.sport}
                    {!live && r.startsAt && ` · ${t.schedule.startsIn(r.startsAt.getTime() - now)}`}
                  </span>
                </span>
                {live ? (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">{t.featured.live}</span>
                ) : (
                  <span className="text-sm text-accent">{t.featured.join} →</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
