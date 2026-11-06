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
  srv_rows: number;
  srv_messages: number;
  srv_roars: number;
  lag_spread_ms: number | null;
}
interface Day {
  day: string;
  users: number;
}

// Real usage only: test and bot profiles are excluded everywhere.
const REAL = sql`not coalesce(p.is_test, false) and not coalesce(p.is_bot, false)`;

async function getStats(): Promise<{ c: Counts; days: Day[] }> {
  const [counts, days] = await Promise.all([
    db().execute(sql`
      select
        (select count(distinct user_id) from events where name = 'joined' and not is_test)::int as users,
        (select count(*) from rooms r join profiles p on p.id = r.created_by where ${REAL} and r.kind = 'room')::int as rooms,
        (select count(*) from events where name = 'message_sent' and not is_test)::int as messages,
        (select count(*) from events where name = 'revealed_on_time' and not is_test)::int as spoilers,
        (select count(*) from events where name = 'roar_sent' and not is_test)::int as roars,
        (select count(*) from nc_messages m left join profiles p on p.id = m.user_id where ${REAL})::int as srv_rows,
        (select count(*) from nc_messages m left join profiles p on p.id = m.user_id where ${REAL} and m.message_type = 'RC:TxtMsg')::int as srv_messages,
        (select count(*) from nc_messages m left join profiles p on p.id = m.user_id where ${REAL} and m.message_type = 'SB:Roar')::int as srv_roars,
        (
          with latest as (
            select distinct on (m.channel_id, m.user_id) m.channel_id, m.lag
            from nc_messages m left join profiles p on p.id = m.user_id
            where m.lag is not null and ${REAL}
            order by m.channel_id, m.user_id, m.sent_at desc
          ),
          spreads as (select max(lag) - min(lag) as s from latest group by channel_id having count(*) >= 2)
          select percentile_cont(0.5) within group (order by s) from spreads
        )::float as lag_spread_ms
    `),
    // Daily active users (IST days): anyone with an in-app event or a server-seen message that day.
    db().execute(sql`
      with acts as (
        select user_id, created_at as at from events where not is_test and user_id is not null and created_at > now() - interval '14 days'
        union all
        select m.user_id, m.sent_at from nc_messages m left join profiles p on p.id = m.user_id where ${REAL} and m.sent_at > now() - interval '14 days'
      )
      select to_char(d, 'YYYY-MM-DD') as day, count(distinct a.user_id)::int as users
      from generate_series((now() at time zone 'Asia/Kolkata')::date - 13, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d
      left join acts a on (a.at at time zone 'Asia/Kolkata')::date = d::date
      group by d order by d
    `),
  ]);
  return { c: counts.rows[0] as unknown as Counts, days: days.rows as unknown as Day[] };
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
  const s = await getStats().catch((e) => (console.error("stats failed", (e as Error).message), null));
  if (!s) return <p className="mt-6">{t.errors.generic}</p>;
  const { c, days } = s;
  const server = c.srv_rows > 0; // webhook is on: Nexconn's own delivery is the primary source
  const tiles: [string, string][] = [
    [t.stats.users, fmt(c.users)],
    [t.stats.rooms, fmt(c.rooms)],
    [t.stats.messages, fmt(server ? c.srv_messages : c.messages)],
    [t.stats.spoilersBlocked, fmt(c.spoilers)],
    [t.stats.roars, fmt(server ? c.srv_roars : c.roars)],
    [t.stats.lagSpread, c.lag_spread_ms === null ? "–" : `${Math.round(c.lag_spread_ms / 1000)}s`],
  ];
  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-display text-4xl text-accent">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{server ? t.stats.sourceServer : t.stats.sourceClient}</p>
      <DauChart days={days} />
    </>
  );
}

const fmt = (n: number) => Number(n).toLocaleString("en-IN");

/** Daily active users, last 14 days. One series, so no legend; each bar shows its value on hover/focus. */
function DauChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.users));
  const label = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <section aria-labelledby="dau" className="mt-8 rounded-2xl border border-line bg-surface p-4">
      <h2 id="dau" className="text-sm text-muted">
        {t.stats.dau}
      </h2>
      <div aria-hidden className="mt-4 flex h-32 items-end gap-[2px] border-b border-line">
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
            <div className="w-full max-w-5 rounded-t-[4px] bg-accent" style={{ height: d.users ? `${(d.users / max) * 100}%` : "0" }} />
            <span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 text-xs text-foreground group-hover:block">
              {label(d.day)}: {d.users}
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{days[0] && label(days[0].day)}</span>
        <span>{days.at(-1) && label(days.at(-1)!.day)}</span>
      </div>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">{t.stats.table}</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="font-normal">{t.stats.day}</th>
              <th className="font-normal">{t.stats.dauShort}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td>{label(d.day)}</td>
                <td className="text-foreground">{d.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
