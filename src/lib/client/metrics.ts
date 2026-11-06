// Batched metric beacons. Flushes every 5 s and when the page is hidden.

import type { METRIC_EVENTS } from "../api-schemas";

type Name = (typeof METRIC_EVENTS)[number];
interface Ev {
  name: Name;
  roomCode?: string;
  props?: Record<string, string | number | boolean>;
}

const queue: Ev[] = [];
let guestId: string | undefined;
let timer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;

export function setMetricsUser(id: string | undefined) {
  guestId = id;
}

export function track(name: Name, roomCode?: string, props?: Ev["props"]) {
  if (typeof window === "undefined") return;
  queue.push({ name, roomCode, props });
  if (!hooked) {
    hooked = true;
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush(true));
  }
  if (queue.length >= 50) flush();
  else timer ??= setTimeout(() => flush(), 5000);
}

export function flush(beacon = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 100);
  const payload = JSON.stringify({ guestId, events });
  if (beacon && navigator.sendBeacon?.("/api/metrics", new Blob([payload], { type: "application/json" }))) return;
  fetch("/api/metrics", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {
    // metrics are best effort
  });
}
