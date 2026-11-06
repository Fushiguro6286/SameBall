"use client";

import { t } from "@/lib/i18n";
import type { LagSuggestion } from "@/lib/timing/calibration";

/** A suggestion only: the lag changes when the viewer taps Apply, never on its own. */
export function CalibrationCard({ s, onApply, onDismiss }: { s: LagSuggestion; onApply: () => void; onDismiss: () => void }) {
  const d = Math.round(Math.abs(s.delta) / 1000);
  return (
    <div role="status" className="pop-in mx-auto mb-1 max-w-xl px-3">
      <div className="rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm">
        <p>{s.delta > 0 ? t.calibrate.later(d, s.moments) : t.calibrate.earlier(d, s.moments)}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={onApply} className="rounded-full bg-accent px-3 py-1.5 font-semibold text-accent-ink">
            {t.calibrate.apply(Math.round(s.lag / 1000))}
          </button>
          <button onClick={onDismiss} className="rounded-full border border-line px-3 py-1.5">
            {t.calibrate.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
