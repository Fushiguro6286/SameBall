"use client";

import { useEffect, useState } from "react";
import { ApiError, catchupApi, type Auth } from "@/lib/client/api";
import { track } from "@/lib/client/metrics";
import { CATCHUP_MAX_MSGS } from "@/lib/config";
import { t } from "@/lib/i18n";
import type { ViewItem } from "@/lib/timing/room-store";
import { Sheet } from "./Sheet";

type State = { kind: "loading" } | { kind: "done"; bullets: string[] } | { kind: "error"; rate: boolean };

/** Summarizes revealed messages only. Locked items carry no text, and the server re-checks each one against my lag. */
export function CatchupSheet({ open, onClose, auth, code, items, lagMs }: { open: boolean; onClose: () => void; auth: Auth; code: string; items: ViewItem[]; lagMs: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const msgs = items
      .filter((v) => v.kind === "text" && !v.locked && !v.spoiled && v.text)
      .slice(-CATCHUP_MAX_MSGS)
      .map((v) => ({ name: v.senderName, text: v.text!, matchTime: v.revealAt - lagMs }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading for each request
    setState({ kind: "loading" });
    catchupApi(auth, code, lagMs, msgs)
      .then((r) => {
        if (!live) return;
        setState({ kind: "done", bullets: r.bullets });
        track("catchup_used", code, { msgs: msgs.length });
      })
      .catch((e) => live && setState({ kind: "error", rate: e instanceof ApiError && e.status === 429 }));
    return () => {
      live = false;
    };
    // Snapshot the chat when the sheet opens (or on Refresh), not on every new message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, run]);

  return (
    <Sheet open={open} onClose={onClose} title={t.catchup.title}>
      <div aria-live="polite" className="mt-3 min-h-24">
        {state.kind === "loading" && <p className="text-muted">{t.catchup.loading}</p>}
        {state.kind === "error" && <p className="text-danger">{state.rate ? t.errors.rate : t.catchup.failed}</p>}
        {state.kind === "done" &&
          (state.bullets.length ? (
            <ul className="space-y-2">
              {state.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    •
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t.catchup.quiet}</p>
          ))}
      </div>
      <p className="mt-4 text-xs text-muted">{t.catchup.note}</p>
      <button onClick={() => setRun((r) => r + 1)} disabled={state.kind === "loading"} className="mt-3 w-full rounded-full border border-line py-2.5 disabled:opacity-50">
        {t.catchup.refresh}
      </button>
    </Sheet>
  );
}
