"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadRooms, type SavedRoom } from "@/lib/client/storage";
import { useT } from "@/lib/i18n/client";

// No last-message previews here, ever (spoiler rule).
export function MyRooms() {
  const t = useT();
  const [rooms, setRooms] = useState<SavedRoom[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only
  useEffect(() => setRooms(loadRooms()), []);
  if (!rooms.length) return null;
  return (
    <section aria-labelledby="my-rooms" className="w-full">
      <h2 id="my-rooms" className="mb-3 font-display text-3xl">
        {t.landing.myRooms}
      </h2>
      <ul className="space-y-2">
        {rooms.map((r) => (
          <li key={r.code}>
            <Link href={`/r/${r.code}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <span className="truncate">{r.name}</span>
              <span className="ml-3 font-mono text-xs text-muted">{r.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
