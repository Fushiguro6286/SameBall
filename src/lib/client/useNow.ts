"use client";
import { useEffect, useState } from "react";

/** Re-renders every `ms` while `active`, returning Date.now() + offset. */
export function useNow(active: boolean, ms = 1000, offset = 0): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now() + offset);
    // Tick right away too: while inactive `now` went stale, and a countdown would show it for a whole interval.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, ms);
    return () => (clearTimeout(first), clearInterval(id));
  }, [active, ms, offset]);
  return now;
}
