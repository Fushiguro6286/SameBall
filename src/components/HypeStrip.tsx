"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/lib/client/useNow";
import { t } from "@/lib/i18n";
import { HYPE_HIGH, hypeHeat, type Pending } from "@/lib/timing/hype";

/** Thin heartbeat above the input. Shows intensity only, never content or whether it's good or bad news. */
export function HypeStrip({ pending, clockOffset }: { pending: Pending[]; clockOffset: number }) {
  const now = useNow(pending.length > 0, 500, clockOffset);
  const { heat, nextAt } = hypeHeat(pending, now);
  const high = heat >= HYPE_HIGH && nextAt !== null;
  const wasHigh = useRef(false);

  useEffect(() => {
    if (high && !wasHigh.current) navigator.vibrate?.([40, 60, 40]);
    wasHigh.current = high;
  }, [high]);

  const beat = `${(2.2 - 1.7 * heat).toFixed(2)}s`;
  return (
    <div className="px-3">
      <div className="mx-auto max-w-xl">
        <div aria-hidden className="relative h-1 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full bg-accent transition-[width,opacity] duration-500 ${heat > 0.05 ? "hype-beat" : ""}`}
            style={{ width: `${Math.max(4, heat * 100)}%`, opacity: 0.25 + heat * 0.75, animationDuration: beat }}
          />
        </div>
        {/* The countdown ticks, so screen readers get one static line instead. */}
        <p aria-hidden className="h-5 pt-0.5 text-center text-xs font-semibold text-accent">
          {high ? t.hype.coming(Math.max(1, Math.ceil((nextAt - now) / 1000))) : ""}
        </p>
        <p aria-live="polite" className="sr-only">
          {high ? t.hype.comingSr : ""}
        </p>
      </div>
    </div>
  );
}
