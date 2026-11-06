"use client";

import { useEffect, useState } from "react";
import { presenceApi } from "@/lib/client/api";
import { t } from "@/lib/i18n";
import { rankLags, type Badge, type BoardEntry } from "@/lib/lag-board";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";

const HEARTBEAT_MS = 30_000;

/** Heartbeats while the room is open; returns how many members beat recently (null until known or in demo). */
export function useWatching(guestId: string, code: string, enabled: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const beat = () => {
      if (document.visibilityState === "hidden") return;
      presenceApi(guestId, code)
        .then((r) => alive && setN(r.watching))
        .catch(() => undefined);
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [guestId, code, enabled]);
  return n;
}

const badgeText = (b: Badge) => (b.kind === "fastest" ? t.board.liveWire : b.kind === "slowest" ? t.board.past(b.s) : t.board.behind(b.s));

export function LagBoard({ entries, myId, watching }: { entries: BoardEntry[]; myId: string; watching: number | null }) {
  const [open, setOpen] = useState(false);
  const ranked = rankLags(entries);
  const me = ranked.find((r) => r.senderId === myId);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-1.5 text-left text-xs text-muted" aria-label={t.board.open}>
        <span className="flex -space-x-1.5">
          {ranked.slice(0, 4).map((r) => (
            <span key={r.senderId} className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[11px] ring-2 ring-background">
              {r.avatar}
            </span>
          ))}
        </span>
        <span className="truncate">
          {watching !== null && t.board.watching(watching)}
          {watching !== null && me && " · "}
          {me && `${t.room.you}: ${badgeText(me.badge)}`}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.board.title}>
        <p className="mt-1 text-sm text-muted">{t.board.help}</p>
        {watching !== null && <p className="mt-2 text-sm">{t.board.watching(watching)}</p>}
        <ol className="mt-3 flex flex-col gap-2">
          {ranked.map((r) => (
            <li key={r.senderId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3 py-2">
              <Avatar emoji={r.avatar} size="sm" />
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.senderId === myId && <span className="text-muted"> ({t.room.you})</span>}
              </span>
              <span className={`text-sm font-semibold ${r.badge.kind === "fastest" ? "text-accent" : ""}`}>{badgeText(r.badge)}</span>
            </li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}
