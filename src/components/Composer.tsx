"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MESSAGE_MAX } from "@/lib/config";
import { useT } from "@/lib/i18n/client";

export function Composer({
  disabled,
  onSend,
  chips = [],
  chipsLead,
  cooldownS = 0,
  validate,
  children,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
  chips?: readonly string[];
  /** Rendered first in the chip row (the chip pack picker). */
  chipsLead?: ReactNode;
  /** Creator-room slow mode: seconds between my messages. */
  cooldownS?: number;
  /** Returns an error to show instead of sending (e.g. a blocked word). */
  validate?: (text: string) => string | null;
  /** Rendered beside the input (the roar button). */
  children?: ReactNode;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState(0);
  const [now, setNow] = useState(0);
  const waitS = Math.max(0, Math.ceil((nextAt - now) / 1000));
  useEffect(() => {
    if (nextAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [nextAt]);
  const cooling = waitS > 0;

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || sending || cooling) return;
    const why = validate?.(v) ?? null;
    setRefused(why);
    if (why) return;
    setSending(true);
    setFailed(null);
    try {
      await onSend(v);
      if (cooldownS > 0) {
        setNow(Date.now());
        setNextAt(Date.now() + cooldownS * 1000);
      }
      setText((cur) => (cur.trim() === v ? "" : cur));
    } catch {
      setFailed(v);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-line bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      {failed && (
        <div role="alert" className="mx-auto mb-2 flex max-w-xl items-center justify-between rounded-xl bg-danger/15 px-3 py-2 text-sm">
          <span>{t.room.sendFailed}</span>
          <button onClick={() => send(failed)} className="rounded-full bg-danger px-3 py-1 font-semibold text-black">
            {t.room.retry}
          </button>
        </div>
      )}
      {(refused || cooling) && (
        <p role="status" className="mx-auto mb-2 max-w-xl rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          {refused ?? t.creator.slowWait(waitS)}
        </p>
      )}
      {chips.length > 0 && (
        <div role="group" aria-label={t.room.quickChat} className="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
          {chipsLead}
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled || sending || cooling}
              onClick={() => send(c)}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold active:scale-95 disabled:opacity-40"
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <form
        className="mx-auto flex max-w-xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label className="sr-only" htmlFor="composer">
          {t.room.placeholder}
        </label>
        <input
          id="composer"
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.room.placeholder}
          autoComplete="off"
          enterKeyHint="send"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-3 text-base placeholder:text-muted disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || cooling || !text.trim()}
          className="rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink disabled:opacity-40"
        >
          {t.room.send}
        </button>
        {children}
      </form>
    </div>
  );
}
