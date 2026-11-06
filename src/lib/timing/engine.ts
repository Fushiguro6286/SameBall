// Pure timing math. All times are server-time milliseconds.

// Ghost Crowd replays a room days later, so the clamp matches Nexconn's 180-day history.
export const MAX_LAG_MS = 180 * 24 * 60 * 60_000;
/** Lags above this are replay viewers, not live feeds (left out of the Lag Leaderboard). */
export const LIVE_MAX_LAG_MS = 6 * 60 * 60_000;

export function clampLag(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(MAX_LAG_MS, Math.max(0, Math.round(ms)));
}

export type MsgKind = "text" | "voice" | "roar" | "lag" | "anchor" | "synccheck" | "synctap" | "call" | "callvote" | "callresult" | "host" | "score";

export interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  avatar: string;
  kind: MsgKind;
  /** Text body. Kept in memory only; never rendered while locked. */
  text?: string;
  /** Parsed payload for SB:* custom messages. */
  payload?: Record<string, unknown>;
  /** Sender's lag at send time. null = malformed/missing stamp, so the message is never locked. */
  lag: number | null;
  /** Server-assigned sent time (Nexconn Message.sentTime). */
  sentTime: number;
}

/** Chat a person wrote or said (text or a voice note), as opposed to reactions and control messages. */
export const isChat = (m: { kind: MsgKind }) => m.kind === "text" || m.kind === "voice";

export const matchTime = (m: ChatMsg) => m.sentTime - (m.lag ?? 0);

export const revealAt = (m: ChatMsg, myLag: number) => matchTime(m) + myLag;

/** Whether the message is hidden from me right now (ignores the permanent "already revealed" set). */
export function isLocked(m: ChatMsg, myId: string, myLag: number, now: number): boolean {
  if (m.senderId === myId || m.lag === null) return false;
  return now < revealAt(m, myLag);
}

/** Timeline order: match time, then server time, then id. */
export function compareMsgs(a: ChatMsg, b: ChatMsg): number {
  return matchTime(a) - matchTime(b) || a.sentTime - b.sentTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
