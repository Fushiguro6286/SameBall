"use client";

import { LAG_SOURCES, NUDGE_LATE_S, NUDGE_SPOILED_S, SLIDER_MAX_S } from "@/lib/config";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";

export function LagSheet({
  open,
  onClose,
  lagMs,
  source,
  onChange,
  onPause,
  couch,
}: {
  open: boolean;
  onClose: () => void;
  lagMs: number;
  source: string;
  onChange: (ms: number, source: string) => void;
  /** "I paused my stream": the chat waits until I'm back. */
  onPause?: () => void;
  /** Couch mode: share a friend's feed and follow their adjustments. */
  couch?: { members: { senderId: string; name: string; avatar: string }[]; linked: string | null; onLink: (id: string | null) => void };
}) {
  const t = useT();
  const secs = Math.round(lagMs / 1000);
  const setSecs = (s: number, src = "custom") => onChange(Math.max(0, s) * 1000, src);

  return (
    <Sheet open={open} onClose={onClose} title={t.lag.title}>
      <p className="mt-1 text-sm text-muted">{t.lag.subtitle}</p>

      {couch && couch.members.length > 0 && (
        <div role="group" aria-label={t.lag.couch} className="mt-4">
          <p className="text-sm font-semibold">🛋️ {t.lag.couch}</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {couch.members.map((m) => (
              <button
                key={m.senderId}
                aria-pressed={couch.linked === m.senderId}
                onClick={() => couch.onLink(couch.linked === m.senderId ? null : m.senderId)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-3 text-sm aria-pressed:border-accent aria-pressed:bg-accent/15"
              >
                <Avatar emoji={m.avatar} size="sm" />
                {m.name}
              </button>
            ))}
          </div>
          {couch.linked && <p className="mt-1 text-xs text-muted">{t.lag.couchOn(couch.members.find((m) => m.senderId === couch.linked)?.name ?? "")}</p>}
        </div>
      )}

      <div role="group" aria-label={t.lag.title} className="mt-4 grid grid-cols-3 gap-2">
        {LAG_SOURCES.map((src) => (
          <button
            key={src.id}
            aria-pressed={source === src.id}
            onClick={() => setSecs(src.seconds, src.id)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface-2 px-2 py-3 text-sm aria-pressed:border-accent aria-pressed:bg-accent/15"
          >
            <span aria-hidden className="text-2xl">
              {src.emoji}
            </span>
            {t.lag.sources[src.id]}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="lag-slider" className="text-sm text-muted">
            {t.lag.fineTune}
          </label>
          <output htmlFor="lag-slider" className="font-display text-2xl text-accent">
            {t.room.lagBadge(secs)}
          </output>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button aria-label={t.lag.minus} onClick={() => setSecs(secs - 1)} className="h-11 w-11 shrink-0 rounded-full border border-line bg-surface-2 text-xl">
            −
          </button>
          <input
            id="lag-slider"
            type="range"
            min={0}
            max={SLIDER_MAX_S}
            step={1}
            value={Math.min(secs, SLIDER_MAX_S)}
            onChange={(e) => setSecs(Number(e.target.value))}
            aria-valuetext={t.lag.seconds(secs)}
            className="h-2 w-full accent-[var(--accent)]"
          />
          <button aria-label={t.lag.plus} onClick={() => setSecs(secs + 1)} className="h-11 w-11 shrink-0 rounded-full border border-line bg-surface-2 text-xl">
            +
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">{t.lag.seconds(secs)}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => setSecs(secs + NUDGE_SPOILED_S, source)} className="rounded-full border border-line bg-surface-2 px-3 py-2.5 text-sm">
          {t.lag.spoiled}
        </button>
        <button onClick={() => setSecs(secs + NUDGE_LATE_S, source)} className="rounded-full border border-line bg-surface-2 px-3 py-2.5 text-sm">
          {t.lag.late}
        </button>
      </div>

      {onPause && (
        <button onClick={onPause} className="mt-4 w-full rounded-full border border-line bg-surface-2 py-2.5 text-sm">
          ⏸ {t.pause.button}
        </button>
      )}

      <button onClick={onClose} className="mt-5 w-full rounded-full bg-accent py-3 font-semibold text-accent-ink">
        {t.lag.done}
      </button>
    </Sheet>
  );
}
