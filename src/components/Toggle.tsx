"use client";

import { useId } from "react";

/** An accessible on/off switch row. */
export function Toggle({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (on: boolean) => void }) {
  const helpId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-describedby={help ? helpId : undefined}
      onClick={() => onChange(!on)}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left"
    >
      <span className="flex-1">
        <span className="block">{label}</span>
        {help && (
          <span id={helpId} className="mt-0.5 block text-xs text-muted">
            {help}
          </span>
        )}
      </span>
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
