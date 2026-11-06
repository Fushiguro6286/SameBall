"use client";

import { useState } from "react";
import type { Sport } from "@/lib/config";
import { useT } from "@/lib/i18n/client";
import { CALL_LOCK, type CallPoints, type CallState } from "@/lib/timing/callit";
import { Sheet } from "./Sheet";

/** The latest "Call it": pick before the moment reaches your screen; the asker locks and answers. */
export function CallCard({
  call,
  board,
  myId,
  onPick,
  onAnswer,
}: {
  call: CallState | null;
  board: CallPoints[];
  myId: string;
  onPick: (callId: string, pick: number) => Promise<void>;
  onAnswer: (callId: string, answer: number) => Promise<void>;
}) {
  const t = useT();
  const [hidden, setHidden] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!call || hidden === call.callId) return null;

  const asker = call.askedBy.senderId === myId;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const won = call.answer !== null && call.winners.some((w) => w.senderId === myId);
  const myPoints = board.find((b) => b.senderId === myId)?.points ?? 0;

  return (
    <section aria-live="polite" className="pop-in border-b border-line bg-surface-2 px-4 py-3">
      <div className="mx-auto max-w-xl text-sm">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1">
            <span className="font-semibold">🎯 {t.call.asks(asker ? t.room.you : call.askedBy.name)}</span> {call.q}
          </p>
          <button onClick={() => setHidden(call.callId)} aria-label={t.lag.close} className="px-1 text-lg leading-none text-muted">
            ×
          </button>
        </div>

        {call.answer !== null ? (
          <div className="mt-2">
            <p className="font-display text-2xl">{t.call.itWas(call.opts[call.answer] ?? "?")}</p>
            <p className={won ? "font-semibold text-accent" : "text-muted"}>
              {won ? t.call.won(myPoints) : call.mine !== null ? t.call.lost : t.call.missed}
            </p>
            {board.length > 0 && (
              <ol className="mt-2 flex flex-wrap gap-2 text-xs" aria-label={t.call.board}>
                {board.slice(0, 5).map((b, i) => (
                  <li key={b.senderId} className="rounded-full border border-line px-2 py-1">
                    {i === 0 ? "🏆 " : ""}
                    {b.avatar} {b.senderId === myId ? t.room.you : b.name} · {b.points}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={call.q}>
              {call.opts.map((o, i) => (
                <button
                  key={i}
                  disabled={busy || call.closed}
                  aria-pressed={call.mine === i}
                  onClick={() => run(() => onPick(call.callId, i))}
                  className={`rounded-full px-4 py-2 font-semibold disabled:opacity-60 ${call.mine === i ? "bg-accent text-accent-ink" : "border border-line"}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {call.closed ? t.call.locked : t.call.closesHint} · {t.call.pickers(call.pickers)}
            </p>
            {asker && !call.answered && (
              <div className="mt-3 border-t border-line pt-2">
                <p className="text-xs text-muted">{t.call.askerHelp}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!call.closed && (
                    <button disabled={busy} onClick={() => run(() => onAnswer(call.callId, CALL_LOCK))} className="rounded-full border border-accent/60 px-3 py-1.5 text-accent">
                      {t.call.lock}
                    </button>
                  )}
                  {call.opts.map((o, i) => (
                    <button key={i} disabled={busy} onClick={() => run(() => onAnswer(call.callId, i))} className="rounded-full border border-line px-3 py-1.5">
                      {t.call.happened(o)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {failed && <p className="mt-1 text-danger">{t.room.sendFailed}</p>}
      </div>
    </section>
  );
}

/** Start a "Call it": the sport's preset or a custom yes/no question. */
export function CallStartSheet({ open, onClose, sport, onStart }: { open: boolean; onClose: () => void; sport: Sport; onStart: (q: string, opts: string[]) => Promise<void> }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const preset = t.call.presets[sport] ?? t.call.presets.other;
  const start = async (question: string, opts: string[]) => {
    if (!question.trim()) return;
    setBusy(true);
    setFailed(false);
    try {
      await onStart(question.trim(), opts);
      setQ("");
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t.call.title}>
      <p className="mt-1 text-sm text-muted">{t.call.help}</p>
      <button
        disabled={busy}
        onClick={() => start(preset.q, preset.opts)}
        className="mt-3 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left disabled:opacity-50"
      >
        <span className="font-semibold">{preset.q}</span>
        <span className="mt-1 block text-sm text-muted">{preset.opts.join(" · ")}</span>
      </button>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(q, [t.call.yes, t.call.no]);
        }}
      >
        <label htmlFor="call-q" className="sr-only">
          {t.call.custom}
        </label>
        <input
          id="call-q"
          value={q}
          maxLength={60}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.call.custom}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2.5"
        />
        <button disabled={busy || !q.trim()} className="rounded-full bg-accent px-4 font-semibold text-accent-ink disabled:opacity-50">
          {t.call.ask}
        </button>
      </form>
      {failed && <p className="mt-2 text-sm text-danger">{t.room.sendFailed}</p>}
    </Sheet>
  );
}
