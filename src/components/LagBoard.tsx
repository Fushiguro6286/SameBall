"use client";

import { useEffect, useState } from "react";
import { errorText, moderateApi, presenceApi, reportApi, type Auth } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n/en";
import { rankLags, type Badge, type BoardEntry } from "@/lib/lag-board";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";

const HEARTBEAT_MS = 30_000;

/** Heartbeats while the room is open; returns how many members beat recently (null until known or in demo). */
export function useWatching(guestId: string, key: string, code: string, enabled: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const beat = () => {
      if (document.visibilityState === "hidden") return;
      presenceApi({ guestId, key } satisfies Auth, code)
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
  }, [guestId, key, code, enabled]);
  return n;
}

const badgeText = (t: Dict, b: Badge) => (b.kind === "fastest" ? t.board.liveWire : b.kind === "slowest" ? t.board.past(b.s) : t.board.behind(b.s));

export function LagBoard({
  entries,
  auth,
  code,
  isOwner,
  watching,
  blocked,
  onToggleBlock,
}: {
  entries: BoardEntry[];
  /** null in demo mode: no server actions. */
  auth: Auth | null;
  code: string;
  isOwner: boolean;
  watching: number | null;
  blocked: ReadonlySet<string>;
  onToggleBlock: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const myId = auth?.guestId ?? "";
  const ranked = rankLags(entries);
  const me = ranked.find((r) => r.senderId === myId);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setNote(null);
    try {
      await fn();
      setNote(done);
      setActionsFor(null);
    } catch (e) {
      setNote(errorText(e));
    }
  };

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
          {me && `${t.room.you}: ${badgeText(t, me.badge)}`}
        </span>
      </button>
      <Sheet open={open} onClose={() => (setOpen(false), setActionsFor(null), setNote(null))} title={t.board.title}>
        <p className="mt-1 text-sm text-muted">{t.board.help}</p>
        {watching !== null && <p className="mt-2 text-sm">{t.board.watching(watching)}</p>}
        {note && (
          <p role="status" className="mt-2 text-sm text-accent">
            {note}
          </p>
        )}
        <ol className="mt-3 flex flex-col gap-2">
          {ranked.map((r) => {
            const other = r.senderId !== myId && !r.senderId.startsWith("bot_");
            const isBlocked = blocked.has(r.senderId);
            return (
              <li key={r.senderId} className="rounded-2xl border border-line bg-surface-2 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar emoji={r.avatar} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    {r.name}
                    {r.senderId === myId && <span className="text-muted"> ({t.room.you})</span>}
                    {isBlocked && <span className="text-muted"> · {t.mod.blockedTag}</span>}
                  </span>
                  <span className={`text-sm font-semibold ${r.badge.kind === "fastest" ? "text-accent" : ""}`}>{badgeText(t, r.badge)}</span>
                  {other && (
                    <button
                      onClick={() => setActionsFor(actionsFor === r.senderId ? null : r.senderId)}
                      aria-expanded={actionsFor === r.senderId}
                      aria-label={t.mod.actionsFor(r.name)}
                      className="rounded-full px-2 text-lg text-muted"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                {other && actionsFor === r.senderId && (
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <button
                      onClick={() => (onToggleBlock(r.senderId), setNote(isBlocked ? t.mod.unblocked(r.name) : t.mod.blocked(r.name)), setActionsFor(null))}
                      className="rounded-full border border-line px-3 py-1.5"
                    >
                      {isBlocked ? t.mod.unblock : t.mod.block}
                    </button>
                    {auth && (
                      <button onClick={() => run(() => reportApi(auth, code, r.senderId), t.mod.reported)} className="rounded-full border border-line px-3 py-1.5">
                        {t.mod.report}
                      </button>
                    )}
                    {auth && isOwner && (
                      <>
                        <button
                          onClick={() => run(() => moderateApi(auth, code, r.senderId, "mute"), t.mod.muted(r.name))}
                          className="rounded-full border border-line px-3 py-1.5"
                        >
                          {t.mod.mute}
                        </button>
                        <button
                          onClick={() => run(() => moderateApi(auth, code, r.senderId, "remove"), t.mod.removed(r.name))}
                          className="rounded-full border border-danger/60 px-3 py-1.5 text-danger"
                        >
                          {t.mod.remove}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Sheet>
    </>
  );
}
