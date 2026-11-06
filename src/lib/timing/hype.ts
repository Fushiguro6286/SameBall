// Hype Radar: how much is about to happen on my screen, as a 0..1 heat.
// Inputs are numbers only (reveal time, sender, weight). Content and sentiment never leave the store.

import { ALL_CHIPS } from "../config";
import type { ChatMsg } from "./engine";

export interface Pending {
  revealAt: number;
  senderId: string;
  weight: number;
}

export const HYPE_WINDOW_MS = 45_000;
export const HYPE_HIGH = 0.6;
const DISTINCT_SENDER_WEIGHT = 3;
const SCALE = 12;

const EMOJI = /\p{Extended_Pictographic}/gu;

/** Intensity of one message. Only text and roars count. */
export function hypeWeight(m: ChatMsg): number {
  if (m.kind === "roar") return 1.2 * (Number(m.payload?.intensity) || 1);
  if (m.kind === "voice") return 1.5; // a voice note during a moment is usually a shout
  if (m.kind !== "text") return 0;
  const text = m.text ?? "";
  const emojis = text.match(EMOJI)?.length ?? 0;
  const letters = text.replace(/[^A-Za-z]/g, "");
  const caps = letters.length >= 3 ? letters.replace(/[^A-Z]/g, "").length / letters.length : 0;
  const bangs = text.match(/!{2,}|\?!|!\?/g)?.length ?? 0;
  return 1 + Math.min(1.5, emojis * 0.4) + caps + Math.min(1, bangs * 0.5) + (ALL_CHIPS.has(text.trim()) ? 1.5 : 0);
}

/** Heat of locked messages revealing within the window, and when the first of them lands. */
export function hypeHeat(pending: Pending[], now: number, windowMs = HYPE_WINDOW_MS): { heat: number; nextAt: number | null } {
  let sum = 0;
  let nextAt: number | null = null;
  const senders = new Set<string>();
  for (const p of pending) {
    if (p.weight <= 0 || p.revealAt <= now || p.revealAt > now + windowMs) continue;
    sum += p.weight;
    senders.add(p.senderId);
    if (nextAt === null || p.revealAt < nextAt) nextAt = p.revealAt;
  }
  const raw = sum + DISTINCT_SENDER_WEIGHT * senders.size;
  return { heat: raw ? 1 - Math.exp(-raw / SCALE) : 0, nextAt };
}
