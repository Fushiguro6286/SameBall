"use client";

import { useState } from "react";
import { track } from "@/lib/client/metrics";
import { useT } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n/en";
import { waveOf, type Moment, type Wave, type Who } from "@/lib/timing/wave";
import { Sheet } from "./Sheet";

const ANIM_S = 2.4;
const LANE_GAP_PCT = 9;

const secs = (ms: number) => Math.round(ms / 1000);

function captionLines(t: Dict, w: Wave): string[] {
  const s = secs(w.spreadMs);
  if (s === 0) return [t.wave.sameTime, t.wave.safe];
  return [t.wave.caption(s), t.wave.firstLast(w.dots[0].name, w.dots[w.dots.length - 1].name), t.wave.safe];
}

/** Dots that would overlap go to the next lane. */
function lanes(w: Wave): number[] {
  const lastPct: number[] = [];
  return w.dots.map((d) => {
    const pct = w.spreadMs ? (d.offset / w.spreadMs) * 100 : 50;
    let lane = lastPct.findIndex((p) => pct - p >= LANE_GAP_PCT);
    if (lane === -1) lane = lastPct.length;
    lastPct[lane] = pct;
    return lane;
  });
}

export function WaveSheet({
  open,
  onClose,
  moments,
  members,
  roomName,
  code,
}: {
  open: boolean;
  onClose: () => void;
  moments: Moment[];
  members: Who[];
  roomName: string;
  code: string;
}) {
  const t = useT();
  const [index, setIndex] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const i = Math.min(index ?? moments.length - 1, moments.length - 1);
  const moment = moments[i];
  if (!moment) return null;
  const wave = waveOf(moment, members);
  const laneOf = lanes(wave);
  const laneCount = Math.max(1, ...laneOf.map((l) => l + 1));
  const go = (d: number) => (setIndex(Math.max(0, Math.min(moments.length - 1, i + d))), setRun((r) => r + 1), setNote(""));

  const share = async () => {
    setBusy(true);
    setNote("");
    try {
      const blob = await drawStory(t, wave, roomName);
      const file = new File([blob], "sameball-wave.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: captionLines(t, wave).join(" ") });
        track("wave_shared", code, { via: "share" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setNote(t.wave.downloaded);
        track("wave_shared", code, { via: "download" });
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setNote(t.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.wave.title}>
      {moments.length > 1 && (
        <div className="mt-1 flex items-center justify-between text-sm text-muted">
          <button onClick={() => go(-1)} disabled={i === 0} aria-label={t.wave.prev} className="rounded-full px-3 py-1 disabled:opacity-30">
            ‹
          </button>
          <span>{t.wave.of(i + 1, moments.length)}</span>
          <button onClick={() => go(1)} disabled={i === moments.length - 1} aria-label={t.wave.next} className="rounded-full px-3 py-1 disabled:opacity-30">
            ›
          </button>
        </div>
      )}

      <div className="mt-3 rounded-3xl border border-line bg-background p-4">
        <p className="font-display text-5xl leading-none text-accent">{t.wave.storySpread(secs(wave.spreadMs))}</p>
        <p className="text-sm text-muted">{t.wave.storySub}</p>
        {/* Decorative animation; the list below carries the same information for screen readers. */}
        <div key={`${moment.id}-${run}`} aria-hidden className="relative mx-5 mt-5" style={{ height: laneCount * 44 + 16 }}>
          <div className="absolute inset-x-0 bottom-2 h-0.5 rounded bg-line" />
          {wave.dots.map((d, k) => (
            <span
              key={d.senderId}
              className="wave-light absolute grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-xl"
              style={{
                left: `${wave.spreadMs ? (d.offset / wave.spreadMs) * 100 : 50}%`,
                bottom: 12 + laneOf[k] * 44,
                animationDelay: `${wave.spreadMs ? (d.offset / wave.spreadMs) * ANIM_S : 0}s`,
              }}
            >
              {d.avatar}
            </span>
          ))}
        </div>
        <ol className="mt-3 space-y-1 text-sm">
          {wave.dots.map((d) => (
            <li key={d.senderId} className="flex items-center gap-2">
              <span aria-hidden>{d.avatar}</span>
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="tabular-nums text-muted">{t.wave.offset(secs(d.offset))}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 space-y-0.5 text-sm">
          {captionLines(t, wave).map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={() => setRun((r) => r + 1)} className="rounded-full border border-line px-4 py-3">
          {t.wave.replay}
        </button>
        <button onClick={share} disabled={busy} className="flex-1 rounded-full bg-accent py-3 font-semibold text-accent-ink disabled:opacity-60">
          {busy ? t.wave.sharing : t.wave.share}
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-center text-sm text-muted">
          {note}
        </p>
      )}
    </Sheet>
  );
}

/** 1080×1920 story image. Names, avatars and timings only: no message content, no logos. */
async function drawStory(t: Dict, w: Wave, roomName: string): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const css = getComputedStyle(document.body);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const bg = v("--background") || "#070b18";
  const fg = v("--foreground") || "#f4f6fb";
  const muted = v("--muted") || "#a3acc6";
  const accent = v("--accent") || "#c6ff3d";
  const surface = v("--surface-2") || "#18213f";
  const display = v("--font-display-face") || "sans-serif";
  const sans = v("--font-geist-sans") || "system-ui, sans-serif";
  await document.fonts?.load(`100px ${display}`).catch(() => undefined);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -150, 50, W / 2, -150, 1300);
  glow.addColorStop(0, "rgba(255,255,255,0.16)");
  glow.addColorStop(0.4, "rgba(198,255,61,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const fit = (text: string, maxW: number) => {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  };
  const text = (s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left", maxW = W - 180) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(fit(s, maxW), x, y);
  };

  text(t.wave.storyKicker, 90, 220, `72px ${display}`, accent);
  text(roomName, 90, 290, `44px ${sans}`, muted);
  text(t.wave.storySpread(secs(w.spreadMs)), 90, 540, `230px ${display}`, fg);
  text(t.wave.storySub, 90, 610, `46px ${sans}`, muted);

  // Worst case (8 rows + a 4-line caption) still ends above the footer at y≈1780.
  const rows = w.dots.slice(0, 8);
  const top = 720;
  const rowH = Math.min(100, 600 / Math.max(1, rows.length));
  const barX = 560;
  const barW = 300;
  rows.forEach((d, k) => {
    const y = top + k * rowH + rowH / 2;
    text(d.avatar, 90, y + 22, `64px ${sans}`, fg);
    text(d.name, 190, y + 16, `44px ${sans}`, fg, "left", barX - 230);
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.roundRect(barX, y - 10, barW, 20, 10);
    ctx.fill();
    const frac = w.spreadMs ? d.offset / w.spreadMs : 0;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(barX, y - 10, Math.max(20, frac * barW), 20, 10);
    ctx.fill();
    text(t.wave.offset(secs(d.offset)), W - 90, y + 16, `44px ${sans}`, k === 0 ? accent : muted, "right", 160);
  });

  // Caption under the rows, word-wrapped.
  let y = top + rows.length * rowH + 100;
  captionLines(t, w).forEach((l, k) => {
    ctx.font = `${k === 0 ? 50 : 42}px ${sans}`;
    const lines: string[] = [];
    for (const word of l.split(" ")) {
      const last = lines.at(-1);
      if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= W - 180) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    for (const line of lines) {
      text(line, 90, y, ctx.font, k === 0 ? fg : muted);
      y += k === 0 ? 66 : 58;
    }
    y += 14;
  });
  text("SameBall", 90, 1840, `76px ${display}`, accent);
  text(location.host, W - 90, 1830, `36px ${sans}`, muted, "right", 520);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
