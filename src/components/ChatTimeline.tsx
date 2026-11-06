"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useNow } from "@/lib/client/useNow";
import { useT } from "@/lib/i18n/client";
import type { ViewItem } from "@/lib/timing/room-store";
import { Avatar } from "./Avatar";
import { LockedBubble } from "./LockedBubble";
import { VoiceNote } from "./VoiceButton";

export function ChatTimeline({
  items,
  clockOffset = 0,
  announce,
  onSpoil,
  autoplay = false,
  hostId,
  onHostAction,
}: {
  items: ViewItem[];
  clockOffset?: number;
  announce: { name: string; text: string } | null;
  onSpoil: (id: string) => void;
  /** Play voice notes as they reach my screen (sound is on). */
  autoplay?: boolean;
  /** Creator rooms: the host's messages get a badge. */
  hostId?: string;
  /** Creator rooms, host only: tap a revealed message to pin or remove it. */
  onHostAction?: (m: ViewItem) => void;
}) {
  const t = useT();
  const anyLocked = items.some((i) => i.locked);
  const now = useNow(anyLocked, 1000, clockOffset);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => (nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
      <ol className="mx-auto flex max-w-xl flex-col gap-3" aria-label="Messages">
        {items.map((m) => (
          <li key={m.id}>
            {m.kind === "anchor" ? (
              <p className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
                <span aria-hidden className="h-px flex-1 bg-line" />
                {m.text}
                <span aria-hidden className="h-px flex-1 bg-line" />
              </p>
            ) : m.locked ? (
              <LockedBubble
                senderName={m.senderName}
                avatar={m.avatar}
                revealAt={m.revealAt}
                lockedSince={m.lockedSince}
                now={now}
                onSpoil={() => onSpoil(m.id)}
              />
            ) : (
              <Bubble m={m} autoplay={autoplay} isHost={!!hostId && m.senderId === hostId} onAction={onHostAction} />
            )}
          </li>
        ))}
      </ol>
      {/* Screen readers hear revealed messages only. */}
      <div aria-live="polite" className="sr-only">
        {announce && t.room.unlocked(announce.name, announce.text)}
      </div>
    </div>
  );
}

function Bubble({ m, autoplay, isHost, onAction }: { m: ViewItem; autoplay: boolean; isHost: boolean; onAction?: (m: ViewItem) => void }) {
  const t = useT();
  if (onAction)
    return (
      <div className="relative">
        <Bubble m={m} autoplay={autoplay} isHost={isHost} />
        {/* Host tools: one small button per message, so the bubble itself stays plain text. */}
        <button
          onClick={() => onAction(m)}
          aria-label={t.creator.actionsFor(m.senderName)}
          className={`absolute top-0 rounded-full px-2 text-muted ${m.mine ? "left-0" : "right-0"}`}
        >
          ⋯
        </button>
      </div>
    );
  if (m.voice) {
    const note = <VoiceNote url={m.voice.url} dur={m.voice.dur} label={t.voice.label(m.senderName, m.voice.dur)} autoplay={autoplay && m.justRevealed && !m.mine} />;
    return m.mine ? (
      <div className="pop-in flex justify-end">
        <div className="rounded-2xl rounded-br-md bg-accent/20 px-2 py-1.5">{note}</div>
      </div>
    ) : (
      <div className="flex items-end gap-2">
        <Avatar emoji={m.avatar} size="sm" />
        <div>
          <div className="mb-0.5 text-xs text-muted">{m.senderName}</div>
          <div className={`rounded-2xl rounded-bl-md border border-line bg-surface-2 px-2 py-1.5 ${m.justRevealed ? "reveal-flash" : ""}`}>{note}</div>
        </div>
      </div>
    );
  }
  if (m.mine) {
    return (
      <div className="pop-in flex justify-end">
        <p className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-accent-ink">{m.text}</p>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <Avatar emoji={m.avatar} size="sm" />
      <div className="max-w-[78%]">
        <div className="mb-0.5 text-xs text-muted">
          {isHost && <span className="mr-1.5 rounded bg-accent px-1 text-[10px] font-semibold uppercase text-accent-ink">{t.creator.hostTag}</span>}
          {m.senderName}
          {m.spoiled && <span className="ml-1.5 rounded bg-danger/20 px-1 text-[10px] uppercase text-danger">{t.room.spoiled}</span>}
        </div>
        <p
          className={`whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border bg-surface-2 px-3.5 py-2 ${isHost ? "border-accent/60" : "border-line"} ${m.justRevealed ? "reveal-flash" : ""}`}
        >
          {m.text}
        </p>
      </div>
    </div>
  );
}
