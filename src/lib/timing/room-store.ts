// Room state: which messages exist, which are locked for me, and when they reveal.
// Pure TS (no React, no DOM) so the rules can be unit-tested.

import { ChatMsg, clampLag, compareMsgs, isLocked, revealAt } from "./engine";
import { hypeWeight, type Pending } from "./hype";
import { RevealScheduler } from "./scheduler";

export interface ViewItem {
  id: string;
  senderId: string;
  senderName: string;
  avatar: string;
  mine: boolean;
  locked: boolean;
  revealAt: number;
  /** When it first showed as locked for me (drives the countdown ring). */
  lockedSince: number;
  /** Present only when unlocked. Locked items never carry content. */
  text?: string;
  justRevealed: boolean;
  spoiled: boolean;
}

export type RevealHow = "schedule" | "spoil";

export interface StoreEvents {
  /** A message arrived that is locked for me. */
  onLocked?(m: ChatMsg): void;
  onRevealed?(msgs: ChatMsg[], how: RevealHow): void;
  onChange?(): void;
}

const HIGHLIGHT_MS = 1600;

export class RoomStore {
  private msgs = new Map<string, ChatMsg>();
  private revealed = new Set<string>();
  private spoiled = new Set<string>();
  private lockedSince = new Map<string, number>();
  private revealedAt = new Map<string, number>();
  private lag: number;
  private pausedAt: number | null = null;
  private scheduler: RevealScheduler;
  /** Bumped on every change; handy for React subscriptions. */
  version = 0;

  constructor(
    readonly myId: string,
    lag: number,
    private now: () => number,
    private ev: StoreEvents = {},
  ) {
    this.lag = clampLag(lag);
    this.scheduler = new RevealScheduler(now, (ids) => this.onDue(ids));
  }

  get paused() {
    return this.pausedAt !== null;
  }

  /** My lag right now. While paused it grows 1 ms per ms. */
  effectiveLag(): number {
    return clampLag(this.lag + (this.pausedAt === null ? 0 : this.now() - this.pausedAt));
  }

  add(list: ChatMsg[]) {
    const now = this.now();
    const lag = this.effectiveLag();
    let changed = false;
    for (const m of list) {
      if (this.msgs.has(m.id)) continue; // dedupe
      this.msgs.set(m.id, m);
      changed = true;
      if (isLocked(m, this.myId, lag, now)) {
        this.lockedSince.set(m.id, now);
        this.scheduler.add(m.id, revealAt(m, this.lag));
        this.ev.onLocked?.(m);
      } else {
        this.revealed.add(m.id);
      }
    }
    if (changed) this.changed();
  }

  setLag(ms: number) {
    this.lag = clampLag(ms);
    if (this.pausedAt !== null) this.pausedAt = this.now();
    this.recompute();
  }

  pause() {
    if (this.pausedAt !== null) return;
    this.pausedAt = this.now();
    this.scheduler.setPaused(true);
    this.changed();
  }

  resume() {
    if (this.pausedAt === null) return;
    this.lag = this.effectiveLag();
    this.pausedAt = null;
    this.scheduler.setPaused(false);
    this.recompute();
  }

  /** Call when the clock offset changes. */
  clockChanged() {
    this.recompute();
  }

  spoil(id: string) {
    const m = this.msgs.get(id);
    if (!m || this.revealed.has(id)) return;
    this.spoiled.add(id);
    this.reveal([m], "spoil");
  }

  spoilAll() {
    const locked = [...this.msgs.values()].filter((m) => !this.revealed.has(m.id));
    if (!locked.length) return;
    locked.forEach((m) => this.spoiled.add(m.id));
    this.reveal(locked, "spoil");
  }

  get(id: string) {
    return this.msgs.get(id);
  }

  isRevealed(id: string) {
    return this.revealed.has(id);
  }

  /** Every message (any kind), in timeline order. For features that need raw data, not display. */
  all(): ChatMsg[] {
    return [...this.msgs.values()].sort(compareMsgs);
  }

  /** Display list: text messages only. Locked items carry no text. */
  view(): ViewItem[] {
    const now = this.now();
    const lag = this.effectiveLag();
    return this.all()
      .filter((m) => m.kind === "text")
      .map((m) => {
        const locked = !this.revealed.has(m.id);
        const ra = this.revealedAt.get(m.id);
        return {
          id: m.id,
          senderId: m.senderId,
          senderName: m.senderName,
          avatar: m.avatar,
          mine: m.senderId === this.myId,
          locked,
          revealAt: revealAt(m, lag),
          lockedSince: this.lockedSince.get(m.id) ?? m.sentTime,
          ...(locked ? {} : { text: m.text ?? "" }),
          justRevealed: ra !== undefined && now - ra < HIGHLIGHT_MS,
          spoiled: this.spoiled.has(m.id),
        };
      });
  }

  /** Locked text and roars as numbers only, for Hype Radar. */
  pending(): Pending[] {
    const lag = this.effectiveLag();
    const out: Pending[] = [];
    for (const m of this.msgs.values()) {
      if (this.revealed.has(m.id)) continue;
      const weight = hypeWeight(m);
      if (weight > 0) out.push({ revealAt: revealAt(m, lag), senderId: m.senderId, weight });
    }
    return out;
  }

  lockedCount(): number {
    let n = 0;
    for (const m of this.msgs.values()) if (m.kind === "text" && !this.revealed.has(m.id)) n++;
    return n;
  }

  dispose() {
    this.scheduler.dispose();
  }

  private recompute() {
    const now = this.now();
    const lag = this.effectiveLag();
    const due: ChatMsg[] = [];
    const pending: { id: string; at: number }[] = [];
    for (const m of this.msgs.values()) {
      if (this.revealed.has(m.id)) continue; // revealed stays revealed
      if (isLocked(m, this.myId, lag, now)) pending.push({ id: m.id, at: revealAt(m, this.lag) });
      else due.push(m);
    }
    this.scheduler.reset(pending);
    if (due.length) this.reveal(due, "schedule");
    else this.changed();
  }

  private onDue(ids: string[]) {
    const now = this.now();
    const lag = this.effectiveLag();
    const due: ChatMsg[] = [];
    for (const id of ids) {
      const m = this.msgs.get(id);
      if (!m || this.revealed.has(id)) continue;
      if (isLocked(m, this.myId, lag, now)) this.scheduler.add(id, revealAt(m, this.lag));
      else due.push(m);
    }
    if (due.length) this.reveal(due, "schedule");
  }

  private reveal(list: ChatMsg[], how: RevealHow) {
    const now = this.now();
    for (const m of list) {
      this.revealed.add(m.id);
      this.revealedAt.set(m.id, now);
    }
    this.ev.onRevealed?.(list, how);
    this.changed();
  }

  private changed() {
    this.version++;
    this.ev.onChange?.();
  }
}
