import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Tx } from "@/components/Lang";
import { NexconnBadge } from "@/components/NexconnBadge";
import { t, type TextKey } from "@/lib/i18n";
import { getDays, getTotals, type Day } from "@/lib/stats";

export const metadata: Metadata = { title: t.stats.title };

/** The daily chart shows only once it has this many days with activity; before that the totals tell the story. */
const CHART_MIN_DAYS = 3;

export default function StatsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Link href="/" className="text-sm text-muted">
        ← {t.appName}
      </Link>
      <h1 className="mt-4 font-display text-5xl">
        <Tx k="stats.title" />
      </h1>
      <p className="mt-2 text-muted">
        <Tx k="stats.subtitle" />
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">…</p>}>
        <Tiles />
      </Suspense>
      <dl className="mt-6 space-y-2 text-xs text-muted">
        {(["spoilers", "parties", "rooms2"] as const).map((k) => (
          <div key={k}>
            <dt className="inline font-semibold text-foreground">
              <Tx k={`stats.help.${k}.term`} />:
            </dt>{" "}
            <dd className="inline">
              <Tx k={`stats.help.${k}.body`} />
            </dd>
          </div>
        ))}
      </dl>
      <NexconnBadge className="mt-8" />
    </main>
  );
}

async function Tiles() {
  await connection();
  const s = await Promise.all([getTotals(), getDays(14)]).catch((e) => (console.error("stats failed", (e as Error).message), null));
  if (!s) return <p className="mt-6">{t.errors.generic}</p>;
  const [c, days] = s;
  const tiles: [TextKey, string][] = [
    ["stats.users", fmt(c.users)],
    ["stats.rooms", fmt(c.rooms)],
    ["stats.rooms2", fmt(c.rooms_2plus)],
    ["stats.messages", fmt(c.messages)],
    ["stats.spoilersBlocked", fmt(c.spoilers)],
    ["stats.parties", fmt(c.watch_parties)],
    ["stats.roars", fmt(c.roars)],
    ["stats.lagSpread", c.lag_spread_ms === null ? "–" : `${Math.round(c.lag_spread_ms / 1000)}s`],
  ];
  const activeDays = days.filter((d) => d.users > 0).length;
  return (
    <>
      {c.since && (
        <p className="mt-4 text-sm">
          <Tx k="stats.since" /> {new Date(`${c.since}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">
              <Tx k={label} />
            </dt>
            <dd className="font-display text-4xl text-accent">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        <Tx k={c.srv_rows > 0 ? "stats.sourceServer" : "stats.sourceClient"} />
      </p>
      {activeDays >= CHART_MIN_DAYS && <DauChart days={days} />}
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
        <Tx k="stats.dau" />
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
        <summary className="cursor-pointer">
          <Tx k="stats.table" />
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="font-normal">
                <Tx k="stats.day" />
              </th>
              <th className="font-normal">
                <Tx k="stats.dauShort" />
              </th>
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
