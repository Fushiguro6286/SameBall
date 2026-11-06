// Procedural stadium crowd: filtered noise layers, slow amplitude LFOs and random swells.
// Synthesized in code, so there are no audio files to license.

interface Active {
  until: number;
  intensity: number;
  sender: string;
}

/** Loudness 0..1 from the sum of active roars and how many distinct people are roaring. */
export function crowdLevel(active: { intensity: number; sender: string }[]): number {
  if (!active.length) return 0;
  const sum = active.reduce((s, a) => s + a.intensity, 0);
  const distinct = new Set(active.map((a) => a.sender)).size;
  return Math.min(1, 0.2 + 0.1 * sum + 0.15 * (distinct - 1));
}

export class Crowd {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: Active[] = [];
  muted = false;

  get ready() {
    return this.ctx?.state === "running";
  }

  /** Must run inside a user gesture (browsers block autoplay). */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.build(this.ctx);
      }
      await this.ctx.resume();
      return this.ready;
    } catch {
      return false;
    }
  }

  /** Adds a roar; returns the new crowd level (also used for the floodlight glow) and how long it lasts. */
  roar(intensity: number, sender: string, durMs: number): { level: number; holdMs: number } {
    const now = performance.now();
    this.active = this.active.filter((a) => a.until > now);
    this.active.push({ until: now + Math.max(1500, durMs) + 1200, intensity, sender });
    const level = crowdLevel(this.active);
    const holdMs = Math.max(...this.active.map((a) => a.until)) - now;
    const g = this.master?.gain;
    if (this.ctx && g && !this.muted && this.ready) {
      const t = this.ctx.currentTime;
      const swell = 0.8 + Math.random() * 0.3;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(level * 0.9, t + 0.25);
      g.linearRampToValueAtTime(level * swell, t + 0.25 + holdMs / 2000);
      g.setTargetAtTime(0, t + holdMs / 1000, 0.6);
    }
    return { level, holdMs };
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m && this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  close() {
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
  }

  private build(ctx: AudioContext) {
    // Two seconds of pink-ish noise (Paul Kellet's filter), looped by every layer at a random offset.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);
    // Low murmur, mid "voice" band and a bright edge.
    for (const [freq, q, gain] of [
      [320, 0.7, 1],
      [850, 1.1, 0.75],
      [2100, 1.6, 0.35],
    ]) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q;
      const layer = ctx.createGain();
      layer.gain.value = gain;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.25 + Math.random() * 0.7;
      const depth = ctx.createGain();
      depth.gain.value = gain * 0.35;
      lfo.connect(depth).connect(layer.gain);
      lfo.start();
      src.connect(f).connect(layer).connect(this.master);
      src.start(0, Math.random() * 2);
    }
  }
}
