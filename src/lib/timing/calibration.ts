// Crowd auto-calibration: estimate my real lag from when I react compared with friends, at the same moments.
// If friend j reacts at server time s_j with lag L_j, and I react at s_me, my lag ≈ s_me − s_j + L_j
// (reaction speed differs per person, so take the median over every friend and every moment).
// The result is only ever a suggestion; nothing here changes anyone's lag.

import { median } from "./clock";
import type { Moment } from "./wave";

/** Shared moments needed before suggesting anything. */
export const CALIBRATION_MIN_MOMENTS = 2;
/** Ignore differences smaller than this (reaction speed noise). */
export const CALIBRATION_MIN_DELTA_MS = 3000;

export interface LagSuggestion {
  /** Suggested lag (ms, ≥ 0). */
  lag: number;
  /** Suggested minus current. Positive = my screen is further behind than my setting. */
  delta: number;
  moments: number;
}

export function suggestLag(moments: Moment[], myId: string, myLag: number): LagSuggestion | null {
  const estimates: number[] = [];
  let shared = 0;
  for (const m of moments) {
    const me = m.reactors.find((r) => r.senderId === myId);
    if (!me) continue;
    const others = m.reactors.filter((r) => r.senderId !== myId);
    if (!others.length) continue;
    shared++;
    for (const o of others) estimates.push(me.firstSent - o.firstSent + o.lag);
  }
  if (shared < CALIBRATION_MIN_MOMENTS) return null;
  const lag = Math.max(0, Math.round(median(estimates) / 1000) * 1000);
  const delta = lag - myLag;
  return Math.abs(delta) >= CALIBRATION_MIN_DELTA_MS ? { lag, delta, moments: shared } : null;
}
