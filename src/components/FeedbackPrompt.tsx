"use client";

import { useEffect, useState } from "react";
import { FEEDBACK_AFTER_MS } from "@/lib/config";
import { t } from "@/lib/i18n";

const askedKey = (code: string) => `sb-feedback:${code}`;

/** Asks once per room, after 20 minutes in it. */
export function FeedbackPrompt({ guestId, guestKey, roomCode }: { guestId: string; guestKey: string; roomCode: string }) {
  const [show, setShow] = useState(false);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(askedKey(roomCode))) return;
    } catch {
      return;
    }
    const id = setTimeout(() => setShow(true), FEEDBACK_AFTER_MS);
    return () => clearTimeout(id);
  }, [roomCode]);

  const submit = async (h: boolean, c?: string) => {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, key: guestKey, roomCode, helpful: h, comment: c || undefined }),
    }).catch(() => undefined);
  };

  const close = () => {
    if (helpful !== null && !done) submit(helpful); // voted but skipped the comment
    setShow(false);
    try {
      localStorage.setItem(askedKey(roomCode), "1");
    } catch {
      // ignore
    }
  };

  if (!show) return null;
  return (
    <div role="dialog" aria-label={t.feedback.question} className="pop-in mx-3 mb-2 rounded-2xl border border-line bg-surface p-3">
      {done ? (
        <div className="flex items-center justify-between text-sm">
          <span>{t.feedback.thanks}</span>
          <button onClick={close} className="text-muted underline">
            {t.feedback.dismiss}
          </button>
        </div>
      ) : helpful === null ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex-1">{t.feedback.question}</span>
          {[true, false].map((h) => (
            <button
              key={String(h)}
              onClick={() => setHelpful(h)}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5"
            >
              {h ? t.feedback.yes : t.feedback.no}
            </button>
          ))}
          <button onClick={close} aria-label={t.feedback.dismiss} className="px-2 text-muted">
            ✕
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(helpful, comment.trim());
            setDone(true);
          }}
        >
          <input
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.feedback.commentPlaceholder}
            aria-label={t.feedback.commentPlaceholder}
            className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3 py-2 text-sm"
          />
          <button className="rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink">{t.feedback.send}</button>
        </form>
      )}
    </div>
  );
}
