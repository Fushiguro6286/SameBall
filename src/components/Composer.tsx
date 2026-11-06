"use client";

import { useState } from "react";
import { MESSAGE_MAX } from "@/lib/config";
import { t } from "@/lib/i18n";

export function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || sending) return;
    setSending(true);
    setFailed(null);
    try {
      await onSend(v);
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
      <form
        className="mx-auto flex max-w-xl gap-2"
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
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-3 text-base placeholder:text-muted/70 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="rounded-full bg-accent px-5 font-semibold text-accent-ink disabled:opacity-40"
        >
          {t.room.send}
        </button>
      </form>
    </div>
  );
}
