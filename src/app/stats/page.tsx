import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.stats.title };

interface Counts {
  users: number;
  rooms: number;
  messages: number;
  spoilers: number;
  roars: number;
}

// Real usage only: events from test/bot profiles are flagged at write time and excluded here.
async function getStats(): Promise<Counts> {
  const res = await db().execute(sql`
    select
      (select count(distinct user_id) from events where name = 'joined' and not is_test)::int as users,
      (select count(*) from rooms r join profiles p on p.id = r.created_by where not p.is_test and not p.is_bot)::int as rooms,
      (select count(*) from events where name = 'message_sent' and not is_test)::int as messages,
      (select count(*) from events where name = 'revealed_on_time' and not is_test)::int as spoilers,
      (select count(*) from events where name = 'roar_sent' and not is_test)::int as roars
  `);
  return res.rows[0] as unknown as Counts;
}

export default function StatsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Link href="/" className="text-sm text-muted">
        ← {t.appName}
      </Link>
      <h1 className="mt-4 font-display text-5xl">{t.stats.title}</h1>
      <p className="mt-2 text-muted">{t.stats.subtitle}</p>
      <Suspense fallback={<p className="mt-6 text-muted">…</p>}>
        <Tiles />
      </Suspense>
      <p className="mt-4 text-xs text-muted">
        {t.stats.spoilersBlocked}: {t.stats.spoilersHelp}
      </p>
    </main>
  );
}

async function Tiles() {
  await connection();
  const s = await getStats().catch(() => null);
  const tiles: [string, number][] = s
    ? [
        [t.stats.users, s.users],
        [t.stats.rooms, s.rooms],
        [t.stats.messages, s.messages],
        [t.stats.spoilersBlocked, s.spoilers],
        [t.stats.roars, s.roars],
      ]
    : [];
  if (!s) return <p className="mt-6">{t.errors.generic}</p>;
  return (
    <dl className="mt-6 grid grid-cols-2 gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-line bg-surface p-4">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="font-display text-4xl text-accent">{Number(value).toLocaleString("en-IN")}</dd>
        </div>
      ))}
    </dl>
  );
}
