// Sync Check: everyone taps NOW at the same unmistakable moment; tap server times reveal relative lags.

import { clampLag } from "./engine";
import { median } from "./clock";

export interface Tap {
  senderId: string;
  /** Server-assigned sent time of the SB:SyncTap message. */
  sentTime: number;
  /** The tapper's lag when they tapped. */
  lag: number;
}

export const SYNC_MAX_SPREAD_MS = 180_000;

/**
 * Suggested lag per person. One tap per person (their first). Taps more than 180 s from the median tap are
 * outliers. The earliest remaining tap is the reference: lag = refLag + (myTap - refTap), so people who
 * didn't tap stay consistent with the reference.
 */
export function solveSync(taps: Tap[]): Map<string, number> {
  const first = new Map<string, Tap>();
  for (const t of [...taps].sort((a, b) => a.sentTime - b.sentTime)) if (!first.has(t.senderId)) first.set(t.senderId, t);
  const list = [...first.values()];
  const out = new Map<string, number>();
  if (list.length < 2) return out;
  const mid = median(list.map((t) => t.sentTime));
  const kept = list.filter((t) => Math.abs(t.sentTime - mid) <= SYNC_MAX_SPREAD_MS);
  if (kept.length < 2) return out;
  const ref = kept[0];
  for (const t of kept) out.set(t.senderId, clampLag(ref.lag + (t.sentTime - ref.sentTime)));
  return out;
}
