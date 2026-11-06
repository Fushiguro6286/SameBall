"use client";

import { useT } from "@/lib/i18n/client";
import type { SyncSuggestion } from "@/lib/timing/autosync";

/** A suggestion only: the lag changes when the viewer taps Apply, never on its own. */
export function CalibrationCard({ s, onApply, onDismiss }: { s: SyncSuggestion; onApply: () => void; onDismiss: () => void }) {
  const t = useT();
  const d = Math.round(Math.abs(s.delta) / 1000);
  const lagS = Math.round(s.lag / 1000);
  return (
    <div role="status" className="pop-in mx-auto mb-1 max-w-xl px-3">
      <div className="rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm">
        <p>{s.drift ? (s.delta > 0 ? t.calibrate.slipped(d) : t.calibrate.caughtUp(d)) : t.calibrate.behind(Math.round(s.behind / 1000), s.observations)}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={onApply} className="rounded-full bg-accent px-3 py-1.5 font-semibold text-accent-ink">
            {t.calibrate.apply(lagS)}
          </button>
          <button onClick={onDismiss} className="rounded-full border border-line px-3 py-1.5">
            {t.calibrate.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
