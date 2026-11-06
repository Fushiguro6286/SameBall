// Sends client crashes to /api/client-error (best effort, at most 10 per page load).
let sent = 0;

export function reportError(err: unknown) {
  if (typeof window === "undefined" || sent >= 10) return;
  sent++;
  const e = err instanceof Error ? err : new Error(String(err));
  fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: e.message.slice(0, 2000), stack: e.stack?.slice(0, 8000), url: location.pathname }),
    keepalive: true,
  }).catch(() => undefined);
}
