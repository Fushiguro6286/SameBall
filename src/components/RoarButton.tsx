"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

const SEND_EVERY_MS = 1500; // at most one roar per ~1.5 s while held
const FULL_MS = 3000;

export const roarIntensity = (heldMs: number): 1 | 2 | 3 => (heldMs < 1000 ? 1 : heldMs < 2500 ? 2 : 3);

/** Hold to roar. The ring fills with intensity; a roar is sent on press and every 1.5 s while held. */
export function RoarButton({ disabled, onStart, onRoar }: { disabled: boolean; onStart: () => void; onRoar: (intensity: 1 | 2 | 3, durMs: number) => void }) {
  const t = useT();
  const [fill, setFill] = useState(0);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSent = useRef(0);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    startedAt.current = null;
    setFill(0);
  };
  useEffect(() => stop, []);

  const start = () => {
    if (disabled || startedAt.current !== null) return;
    onStart();
    const t0 = performance.now();
    startedAt.current = t0;
    lastSent.current = t0;
    onRoar(1, SEND_EVERY_MS);
    timer.current = setInterval(() => {
      const now = performance.now();
      const held = now - t0;
      setFill(Math.min(1, held / FULL_MS));
      if (now - lastSent.current >= SEND_EVERY_MS) {
        lastSent.current = now;
        onRoar(roarIntensity(held), SEND_EVERY_MS);
      }
    }, 100);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={t.roar.label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), start())}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stop()}
      onContextMenu={(e) => e.preventDefault()}
      className="relative grid h-12 w-12 shrink-0 touch-none select-none place-items-center rounded-full disabled:opacity-40"
      style={{ background: `conic-gradient(var(--accent) ${fill * 360}deg, var(--surface-2) 0)` }}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-full bg-background text-xl ${fill > 0 ? "scale-110" : ""} transition-transform`}>
        📣
      </span>
    </button>
  );
}
