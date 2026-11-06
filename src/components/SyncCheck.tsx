"use client";

import { useState } from "react";
import { track } from "@/lib/client/metrics";
import { useNow } from "@/lib/client/useNow";
import { t } from "@/lib/i18n";
import type { SyncState } from "@/lib/room/useRoom";
import { solveSync } from "@/lib/timing/sync-solver";
import { Sheet } from "./Sheet";

const CHECK_TTL_MS = 3 * 60_000;

/** The live Sync Check: tap NOW, then accept or keep the suggested lag. Never changes lag silently. */
export function SyncCheckCard({
  sync,
  myId,
  lagMs,
  clockOffset,
  roomCode,
  onTap,
  onApply,
}: {
  sync: SyncState | null;
  myId: string;
  lagMs: number;
  clockOffset: number;
  roomCode: string;
  onTap: (checkId: string) => Promise<void>;
  onApply: (lagMs: number) => void;
}) {
  const now = useNow(!!sync, 1000, clockOffset);
  const [closed, setClosed] = useState<string | null>(null);
  const [tapping, setTapping] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!sync || closed === sync.checkId || now - sync.startedAt > CHECK_TTL_MS) return null;

  const tapped = sync.taps.some((x) => x.senderId === myId);
  const suggestion = solveSync(sync.taps).get(myId);
  const people = new Set(sync.taps.map((x) => x.senderId)).size;
  const differs = suggestion !== undefined && Math.abs(suggestion - lagMs) >= 1000;

  const tap = async () => {
    setTapping(true);
    setFailed(false);
    try {
      await onTap(sync.checkId);
    } catch {
      setFailed(true);
    } finally {
      setTapping(false);
    }
  };

  return (
    <section aria-live="polite" className="pop-in border-b border-line bg-surface-2 px-4 py-3">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1 text-sm">
          {!tapped ? (
            <p>{t.sync.prompt(sync.startedBy, sync.label)}</p>
          ) : differs ? (
            <p className="font-semibold">{t.sync.apply(Math.round(suggestion / 1000))}</p>
          ) : suggestion !== undefined ? (
            <p>{t.sync.inSync}</p>
          ) : (
            <p className="text-muted">{t.sync.waiting(people)}</p>
          )}
          {failed && <p className="text-danger">{t.room.sendFailed}</p>}
        </div>
        {!tapped ? (
          <button onClick={tap} disabled={tapping} className="rounded-full bg-accent px-6 py-3 font-display text-2xl text-accent-ink disabled:opacity-50">
            {t.sync.now}
          </button>
        ) : differs ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onApply(suggestion);
                track("sync_check_done", roomCode, { applied: true, people });
                setClosed(sync.checkId);
              }}
              className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink"
            >
              {t.sync.yes}
            </button>
            <button
              onClick={() => {
                track("sync_check_done", roomCode, { applied: false, people });
                setClosed(sync.checkId);
              }}
              className="rounded-full border border-line px-4 py-2"
            >
              {t.sync.keep}
            </button>
          </div>
        ) : (
          <button onClick={() => setClosed(sync.checkId)} aria-label={t.lag.close} className="px-2 text-xl text-muted">
            ×
          </button>
        )}
      </div>
    </section>
  );
}

/** Sheet to start a Sync Check with a named moment. */
export function SyncStartSheet({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (label: string) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = async (l: string) => {
    if (!l.trim()) return;
    setBusy(true);
    setFailed(false);
    try {
      await onStart(l.trim());
      setLabel("");
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t.sync.title}>
      <p className="mt-1 text-sm text-muted">{t.sync.help}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {t.sync.presets.map((p) => (
          <button key={p} disabled={busy} onClick={() => start(p)} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm">
            {p}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(label);
        }}
      >
        <label htmlFor="sync-label" className="sr-only">
          {t.sync.labelField}
        </label>
        <input
          id="sync-label"
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.sync.labelField}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2.5"
        />
        <button disabled={busy || !label.trim()} className="rounded-full bg-accent px-4 font-semibold text-accent-ink disabled:opacity-40">
          {t.sync.start}
        </button>
      </form>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {t.room.sendFailed}
        </p>
      )}
    </Sheet>
  );
}
