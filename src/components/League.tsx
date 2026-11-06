"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { ChatMsg } from "@/lib/timing/engine";
import { leagueOf, SERIES_PREFIX, type League } from "@/lib/timing/league";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";

type Load = { kind: "loading" } | { kind: "done"; l: League } | { kind: "error" };

/** Series league: Call it points across the squad's matches in this room, from Nexconn history. */
export function LeagueSheet({
  open,
  onClose,
  load,
  myId,
  ownerId,
  isOwner,
  onStartSeries,
}: {
  open: boolean;
  onClose: () => void;
  load: () => Promise<{ msgs: ChatMsg[]; isRevealed: (id: string) => boolean }>;
  myId: string;
  ownerId?: string;
  isOwner: boolean;
  onStartSeries: (label: string) => Promise<void>;
}) {
  const t = useT();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [name, setName] = useState("");
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for each opening
    setState({ kind: "loading" });
    load()
      .then(({ msgs, isRevealed }) => live && setState({ kind: "done", l: leagueOf(msgs, isRevealed, myId, ownerId) }))
      .catch(() => live && setState({ kind: "error" }));
    return () => {
      live = false;
    };
  }, [open, run, load, myId, ownerId]);

  const maxName = 40 - SERIES_PREFIX.length;
  return (
    <Sheet open={open} onClose={onClose} title={t.league.title}>
      <div className="mt-3 space-y-4">
        {state.kind === "loading" && <p className="text-muted">{t.league.loading}</p>}
        {state.kind === "error" && <p className="text-danger">{t.errors.generic}</p>}
        {state.kind === "done" && (
          <>
            <p className="text-sm text-muted">{state.l.series ? t.league.series(state.l.series) : t.league.noSeries}</p>
            {state.l.champion && (
              <p className="rounded-2xl border border-accent/60 bg-accent/10 px-3 py-2 text-sm">
                {t.league.champion(`${state.l.champion.who.avatar} ${state.l.champion.who.name}`, state.l.champion.series, state.l.champion.who.points)}
              </p>
            )}
            {state.l.board.length === 0 ? (
              <p className="text-sm text-muted">{t.league.empty}</p>
            ) : (
              <ol className="space-y-1.5">
                {state.l.board.map((p, i) => (
                  <li key={p.senderId} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
                    <span className="w-6 text-center font-display text-xl text-muted">{i === 0 ? "👑" : i + 1}</span>
                    <Avatar emoji={p.avatar} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.senderId === myId && <span className="text-muted"> ({t.room.you})</span>}
                    </span>
                    {p.best > 1 && <span className="text-xs text-muted">🔥 {p.best}</span>}
                    <span className="font-display text-2xl text-accent">{p.points}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-muted">{t.league.help}</p>
          </>
        )}
        {isOwner && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = name.trim();
              if (!v) return;
              onStartSeries(SERIES_PREFIX + v.slice(0, maxName))
                .then(() => (setName(""), setRun((r) => r + 1)))
                .catch(() => setState({ kind: "error" }));
            }}
          >
            <label className="sr-only" htmlFor="series-name">
              {t.league.newSeries}
            </label>
            <input
              id="series-name"
              value={name}
              maxLength={maxName}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.league.newSeries}
              className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm placeholder:text-muted"
            />
            <button disabled={!name.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {t.league.start}
            </button>
          </form>
        )}
      </div>
    </Sheet>
  );
}
