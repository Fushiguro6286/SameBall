"use client";
import { useEffect, useState } from "react";

/** Re-renders every `ms` while `active`, returning Date.now() + offset. */
export function useNow(active: boolean, ms = 1000, offset = 0): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now() + offset), ms);
    return () => clearInterval(id);
  }, [active, ms, offset]);
  return now;
}
