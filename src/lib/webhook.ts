// Parses Nexconn post-message webhooks (docs: platform-chat-api/webhook/message/send) into rows we count.
import { z } from "zod";
import { SB_TYPES, TEXT_TYPE, TextExtra, VOICE_TYPE } from "./transport/wire";

const Item = z.object({
  userId: z.string().max(64),
  channelId: z.string().max(64),
  channelType: z.number(),
  messageType: z.string().max(32),
  content: z.string().max(20_000).optional(),
  messageId: z.string().max(64),
  time: z.number(),
});
const Envelope = z.object({ type: z.string(), id: z.string().optional(), data: z.array(z.unknown()).max(100) });

export interface NcRow {
  messageId: string;
  userId: string;
  channelId: string;
  messageType: string;
  lag: number | null;
  sentAt: Date;
}

const GROUP = 3;
const COMMUNITY = 10; // stadiums
const OURS = new Set<string>([TEXT_TYPE, VOICE_TYPE, ...Object.values(SB_TYPES)]);

function json(s: unknown): Record<string, unknown> | null {
  if (typeof s !== "string") return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** The sender's lag stamp, if the content carries a valid one. */
export function lagOf(messageType: string, content: string | undefined): number | null {
  const c = json(content);
  if (!c) return null;
  if (messageType === TEXT_TYPE || messageType === VOICE_TYPE) {
    const ex = TextExtra.safeParse(json(c.extra));
    return ex.success ? Math.round(ex.data.lag) : null;
  }
  return typeof c.lag === "number" && Number.isFinite(c.lag) ? Math.round(c.lag) : null;
}

/** Group- and community-channel messages of our own types; anything else (or malformed) is skipped. */
export function parseWebhook(body: unknown): NcRow[] {
  const env = Envelope.safeParse(body);
  if (!env.success || env.data.type !== "message:send") return [];
  const rows: NcRow[] = [];
  for (const raw of env.data.data) {
    const it = Item.safeParse(raw);
    if (!it.success || (it.data.channelType !== GROUP && it.data.channelType !== COMMUNITY) || !OURS.has(it.data.messageType)) continue;
    rows.push({
      messageId: it.data.messageId,
      userId: it.data.userId,
      channelId: it.data.channelId,
      messageType: it.data.messageType,
      lag: lagOf(it.data.messageType, it.data.content),
      sentAt: new Date(it.data.time),
    });
  }
  return rows;
}
