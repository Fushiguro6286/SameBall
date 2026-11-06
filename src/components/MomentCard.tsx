"use client";

import { useState } from "react";
import { track } from "@/lib/client/metrics";
import { useT } from "@/lib/i18n/client";
import { waveOf, type Moment, type Who } from "@/lib/timing/wave";
import { drawStory, shareImage } from "./WaveSheet";

/** Shown once a big moment has reached every screen in the room: the squad's reactions in the order they saw it. */
export function MomentCard({ moment, members, roomName, code, onClose }: { moment: Moment; members: Who[]; roomName: string; code: string; onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const wave = waveOf(moment, members);
  const quotes = new Map(moment.reactors.map((r) => [r.senderId, r.text ?? t.moment.roar]));
  const rows = wave.dots.filter((d) => quotes.has(d.senderId));

  const share = async () => {
    setBusy(true);
    setNote("");
    try {
      const via = await shareImage(await drawStory(t, { dots: rows, spreadMs: wave.spreadMs }, roomName, quotes), "sameball-moment.png", t.moment.shareText(roomName));
      if (via === "download") setNote(t.wave.downloaded);
      track("moment_card_shared", code, { via });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setNote(t.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t.moment.kicker} className="pop-in border-b border-line bg-surface-2 px-4 py-3">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{t.moment.title(wave.dots.length)}</p>
        <button onClick={onClose} aria-label={t.wave.dismiss} className="rounded-full px-2 text-muted">
          ✕
        </button>
      </div>
      <ol className="mt-2 space-y-1 text-sm">
        {rows.map((d) => (
          <li key={d.senderId} className="flex items-center gap-2">
            <span aria-hidden>{d.avatar}</span>
            <span className="w-20 shrink-0 truncate text-muted">{d.name}</span>
            <span className="min-w-0 flex-1 truncate">{quotes.get(d.senderId)}</span>
            <span className="tabular-nums text-xs text-muted">{t.wave.offset(Math.round(d.offset / 1000))}</span>
          </li>
        ))}
      </ol>
      <button onClick={share} disabled={busy} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
        {busy ? t.wave.sharing : t.moment.share}
      </button>
      {note && (
        <p role="status" className="mt-1 text-xs text-muted">
          {note}
        </p>
      )}
    </section>
  );
}
