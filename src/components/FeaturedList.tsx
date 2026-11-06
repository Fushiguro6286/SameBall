"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export interface FeaturedRow {
  code: string;
  name: string;
  sport: string;
  kind: string;
  startsAt: number | null;
}

export function FeaturedList({ list, now }: { list: FeaturedRow[]; now: number }) {
  const t = useT();
  return (
    <section aria-labelledby="featured" className="w-full">
      <h2 id="featured" className="mb-3 font-display text-3xl">
        {t.featured.title}
      </h2>
      <ul className="grid gap-2">
        {list.map((r) => {
          const live = !r.startsAt || r.startsAt <= now;
          return (
            <li key={r.code}>
              <Link href={`/r/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="text-sm text-muted">
                    {r.kind === "stadium" && `${t.stadium.badge} · `}
                    {t.sports[r.sport] ?? r.sport}
                    {!live && r.startsAt && ` · ${t.schedule.startsIn(r.startsAt - now)}`}
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
