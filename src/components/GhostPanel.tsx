"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/client/metrics";
import { useNow } from "@/lib/client/useNow";
import { t } from "@/lib/i18n";
import type { Anchor } from "@/lib/room/useRoom";

const NUDGES = [-60, -10, 10, 60];

/** "+12:34" / "−0:05" / "+1:02:03" */
function clock(ms: number): string {
  const s = Math.round(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${ms < 0 ? "−" : "+"}${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${ss}`;
}

/**
 * Ghost Crowd: replay a past room in sync with your own replay video.
 * Syncing sets my lag = serverNow − anchor.matchTime; after that it's the normal engine with a lag measured in hours.
 */
export function GhostPanel({
  code,
  anchors,
  firstAt,
  lockedCount,
  ready,
  synced,
  paused,
  clockOffset,
  matchNow,
  onSync,
  onPause,
  onResume,
  onNudge,
  onResync,
}: {
  code: string;
  anchors: Anchor[];
  firstAt: number | null;
  lockedCount: number;
  ready: boolean;
  synced: boolean;
  paused: boolean;
  clockOffset: number;
  matchNow: () => number;
  onSync: (lagMs: number) => void;
  onPause: () => void;
  onResume: () => void;
  onNudge: (lagDeltaMs: number) => void;
  onResync: () => void;
}) {
  const options: Anchor[] = [...anchors];
  if (firstAt !== null)
    options.unshift({
      id: "start",
      label: t.ghost.startOfChat,
      matchTime: firstAt,
      senderId: "",
    });
  const [pickedId, setPickedId] = useState<string | null>(null);
  // Default to the first real anchor ("First ball"), else the start of the chat.
  const picked = options.find((o) => o.id === pickedId) ?? options.find((o) => o.id !== "start") ?? options[0];
  useNow(synced && !paused, 1000);

  if (!synced) {
    return (
      <section aria-label={t.ghost.title} className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto max-w-xl">
          <h2 className="font-display text-3xl leading-none">👻 {t.ghost.title}</h2>
          {!ready ? (
            <p className="mt-2 text-sm text-muted">{t.ghost.loading}</p>
          ) : !picked ? (
            <p className="mt-2 text-sm text-muted">{t.ghost.nothing}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">{t.ghost.body}</p>
              <p className="mt-3 text-xs uppercase tracking-widest text-muted">{t.ghost.pick}</p>
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={t.ghost.pick}>
                {options.map((o) => (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={o.id === picked.id}
                    onClick={() => setPickedId(o.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${o.id === picked.id ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface-2"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  onSync(Date.now() + clockOffset - picked.matchTime);
                  track("replay_started", code, {
                    anchor: picked.id === "start" ? "start" : "anchor",
                  });
                }}
                className="mt-3 w-full rounded-full bg-accent py-3 font-semibold text-accent-ink"
              >
                {t.ghost.sync}
              </button>
              {lockedCount > 0 && <p className="mt-2 text-center text-xs text-muted">{t.ghost.waiting(lockedCount)}</p>}
            </>
          )}
          <Link href={`/r/${code}`} className="mt-2 inline-block text-xs text-muted underline underline-offset-4">
            {t.ghost.live}
          </Link>
        </div>
      </section>
    );
  }

  const label = picked?.label ?? t.ghost.startOfChat;
  const pos = picked ? clock(matchNow() - picked.matchTime) : "";
  return (
    <section aria-label={t.ghost.title} className="border-b border-line bg-surface px-3 py-2">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-accent">{t.ghost.badge}</span>
          <p className="min-w-0 flex-1 truncate font-display text-xl leading-none tabular-nums">
            {t.ghost.position(label, pos)}
            {paused && <span className="ml-2 text-sm text-muted">· {t.ghost.paused}</span>}
          </p>
          <button onClick={onResync} className="rounded-full border border-line px-3 py-1 text-xs">
            {t.ghost.resync}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {NUDGES.slice(0, 2).map((s) => (
            <NudgeButton key={s} s={s} onNudge={onNudge} />
          ))}
          <button
            onClick={paused ? onResume : onPause}
            aria-label={paused ? t.ghost.resume : t.ghost.pause}
            className="mx-1 grid h-11 w-11 place-items-center rounded-full bg-accent text-lg text-accent-ink"
          >
            {paused ? "▶" : "⏸"}
          </button>
          {NUDGES.slice(2).map((s) => (
            <NudgeButton key={s} s={s} onNudge={onNudge} />
          ))}
        </div>
        <p className="mt-1 text-center text-[11px] text-muted">{t.ghost.nudgeHelp}</p>
      </div>
    </section>
  );
}

// +10s moves the chat forward in the match, which means 10 s less lag.
function NudgeButton({ s, onNudge }: { s: number; onNudge: (lagDeltaMs: number) => void }) {
  return (
    <button
      onClick={() => onNudge(-s * 1000)}
      aria-label={t.ghost.nudgeLabel(s)}
      className="h-9 min-w-12 rounded-full border border-line bg-surface-2 px-2 text-sm tabular-nums"
    >
      {t.ghost.nudge(s)}
    </button>
  );
}
