// Wire format. Every payload is versioned and validated with zod.
// Text: a normal RC:TxtMsg whose `extra` field is JSON {"sb":1,"lag":ms,"n":name,"a":avatar}.
// Custom: SB:* message types with tiny JSON content that always carries `lag`.

import { z } from "zod";
import { ChatMsg, MsgKind, clampLag } from "../timing/engine";

export const TEXT_TYPE = "RC:TxtMsg";
/** Nexconn HD voice message (uploaded by the SDK); its `extra` carries the same stamp as text. */
export const VOICE_TYPE = "RC:HQVCMsg";
export const VOICE_MAX_S = 15;

export const SB_TYPES = {
  roar: "SB:Roar",
  lag: "SB:Lag",
  anchor: "SB:Anchor",
  synccheck: "SB:SyncCheck",
  synctap: "SB:SyncTap",
  call: "SB:Call",
  callvote: "SB:CallVote",
  callresult: "SB:CallResult",
  host: "SB:Host",
  score: "SB:Score",
} as const;
export type SbKind = keyof typeof SB_TYPES;
export type SbType = (typeof SB_TYPES)[SbKind];

const lag = z.number().finite();
const who = { n: z.string().max(30).optional(), a: z.string().max(16).optional() };

export const TextExtra = z.object({ sb: z.literal(1), lag, ...who });
export type TextExtra = z.infer<typeof TextExtra>;

const base = { v: z.literal(1), lag, ...who };
export const SbPayloads = {
  roar: z.object({ ...base, intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]), dur: z.number().min(0).max(10_000) }),
  lag: z.object({ ...base, source: z.string().max(16) }),
  anchor: z.object({ ...base, label: z.string().max(40) }),
  synccheck: z.object({ ...base, checkId: z.string().max(32), label: z.string().max(60) }),
  synctap: z.object({ ...base, checkId: z.string().max(32) }),
  call: z.object({ ...base, callId: z.string().max(32), q: z.string().min(1).max(60), opts: z.array(z.string().min(1).max(16)).min(2).max(5) }),
  callvote: z.object({ ...base, callId: z.string().max(32), pick: z.number().int().min(0).max(4) }),
  // answer −1 = "picks locked" (sent before the moment), 0–4 = the option that happened.
  callresult: z.object({ ...base, callId: z.string().max(32), answer: z.number().int().min(-1).max(4) }),
  // Creator rooms, host only: pin a message (id "" = unpin), slow mode for fans, hide a recalled message, quiet fans.
  host: z.object({ ...base, op: z.enum(["pin", "slow", "hide", "quiet"]), id: z.string().max(64).optional(), secs: z.number().int().min(0).max(300).optional(), on: z.boolean().optional() }),
  // Live score line from the host bot, stamped like any message so each screen gets it at its own delay.
  score: z.object({ ...base, s: z.string().min(1).max(40) }),
} satisfies Record<SbKind, z.ZodType>;
export type SbPayload<K extends SbKind> = z.infer<(typeof SbPayloads)[K]>;

/** Transport-neutral raw message. */
export interface RawMsg {
  id: string;
  type: string;
  senderId: string;
  sentTime: number;
  content: Record<string, unknown>;
}

export const encodeTextExtra = (lagMs: number, name: string, avatar: string) =>
  JSON.stringify({ sb: 1, lag: clampLag(lagMs), n: name, a: avatar } satisfies TextExtra);

export const sbContent = <K extends SbKind>(kind: K, p: Omit<SbPayload<K>, "v">) => ({ v: 1 as const, ...p });

function safeJson(s: unknown): unknown {
  if (typeof s !== "string") return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

const KIND_BY_TYPE = Object.fromEntries(Object.entries(SB_TYPES).map(([k, t]) => [t, k])) as Record<string, SbKind>;

/**
 * Raw transport message -> ChatMsg.
 * Text with a malformed stamp still shows (lag null = never locked).
 * Malformed or unknown SB:* / other types are dropped (null).
 */
export function parseIncoming(raw: RawMsg): ChatMsg | null {
  if (!raw.id || !raw.senderId || !Number.isFinite(raw.sentTime)) return null;
  const common = { id: raw.id, senderId: raw.senderId, sentTime: raw.sentTime };

  if (raw.type === TEXT_TYPE) {
    const c = raw.content;
    const text = typeof c.text === "string" ? c.text : typeof c.content === "string" ? c.content : "";
    const ex = TextExtra.safeParse(safeJson(c.extra));
    return {
      ...common,
      kind: "text",
      text,
      lag: ex.success ? clampLag(ex.data.lag) : null,
      senderName: (ex.success && ex.data.n) || raw.senderId.slice(0, 8),
      avatar: (ex.success && ex.data.a) || "👤",
    };
  }

  if (raw.type === VOICE_TYPE) {
    const c = raw.content;
    const url = typeof c.remoteUrl === "string" ? c.remoteUrl : "";
    // Only uploaded files (https) or the local demo's inline audio; anything else is dropped.
    if (!/^https:\/\//.test(url) && !url.startsWith("data:audio/")) return null;
    const ex = TextExtra.safeParse(safeJson(c.extra));
    return {
      ...common,
      kind: "voice",
      payload: { url, dur: Math.min(60, Math.max(0, Number(c.duration) || 0)) },
      lag: ex.success ? clampLag(ex.data.lag) : null,
      senderName: (ex.success && ex.data.n) || raw.senderId.slice(0, 8),
      avatar: (ex.success && ex.data.a) || "👤",
    };
  }

  const kind = KIND_BY_TYPE[raw.type];
  if (!kind) return null;
  const p = SbPayloads[kind].safeParse(raw.content);
  if (!p.success) return null;
  return {
    ...common,
    kind: kind as MsgKind,
    payload: p.data,
    lag: clampLag(p.data.lag),
    senderName: p.data.n || raw.senderId.slice(0, 8),
    avatar: p.data.a || "👤",
  };
}
