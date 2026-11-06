// NTP-style clock offset against our /api/time endpoint.

export interface ClockSample {
  t0: number; // local send time
  ts: number; // server time
  t1: number; // local receive time
}

export const offsetOf = ({ t0, ts, t1 }: ClockSample) => ts - (t0 + t1) / 2;

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const estimateOffset = (samples: ClockSample[]) => median(samples.map(offsetOf));

/** Takes `n` samples sequentially and returns the median offset (server - local). */
export async function measureOffset(
  fetchServerTime: () => Promise<number>,
  n = 5,
  localNow: () => number = Date.now,
): Promise<number> {
  const samples: ClockSample[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = localNow();
    try {
      const ts = await fetchServerTime();
      samples.push({ t0, ts, t1: localNow() });
    } catch {
      // skip failed sample
    }
  }
  if (!samples.length) throw new Error("clock sync failed");
  return estimateOffset(samples);
}
