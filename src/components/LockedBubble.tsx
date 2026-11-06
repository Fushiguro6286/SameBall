"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "./Avatar";

// Receives no message content by design: there is nothing to leak into the DOM.
export function LockedBubble({
  senderName,
  avatar,
  revealAt,
  lockedSince,
  now,
  onSpoil,
}: {
  senderName: string;
  avatar: string;
  revealAt: number;
  lockedSince: number;
  now: number;
  onSpoil: () => void;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const secs = Math.max(0, Math.ceil((revealAt - now) / 1000));
  const total = Math.max(1, revealAt - lockedSince);
  const progress = Math.min(1, Math.max(0, (now - lockedSince) / total));
  const R = 11;
  const C = 2 * Math.PI * R;

  return (
    <div className="pop-in flex items-end gap-2">
      <Avatar emoji={avatar} size="sm" />
      <div className="max-w-[78%]">
        <div className="mb-0.5 text-xs text-muted">{senderName}</div>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl rounded-bl-md border border-accent/50 bg-surface-2 px-3 py-2 text-sm">
            <span>{t.room.spoilPrompt}</span>
            <button onClick={onSpoil} className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-ink">
              {t.room.spoilConfirm}
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-full border border-line px-3 py-1">
              {t.room.spoilCancel}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`${t.room.lockedBy(senderName)}, ${t.room.unlocksIn(secs)}. ${t.room.spoilPrompt}`}
            className="frost relative flex h-11 w-52 items-center overflow-hidden rounded-2xl rounded-bl-md border border-line text-left"
          >
            <span className="frost-glass absolute inset-0 flex items-center justify-between px-3">
              <span aria-hidden className="text-base">
                🔒
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                {t.room.unlocksIn(secs)}
                <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="-rotate-90">
                  <circle cx="13" cy="13" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
                  <circle
                    cx="13"
                    cy="13"
                    r={R}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progress)}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
