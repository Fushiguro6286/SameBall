import { z } from "zod";
import { AVATARS, CATCHUP_MAX_MSGS, MESSAGE_MAX, NAME_MAX, ROOM_NAME_MAX, SPORTS } from "./config";
import { MAX_LAG_MS } from "./timing/engine";

const guestId = z.string().regex(/^g_[A-Za-z0-9]{20}$/);
const roomCode = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const displayName = z.string().trim().min(1).max(NAME_MAX);
const avatar = z.enum(AVATARS);
/** Server-issued guest key (see lib/auth.ts). */
const key = z.string().min(16).max(64);

export const SessionReq = z.object({
  guestId: guestId.optional(),
  name: displayName,
  avatar,
  roomCode: roomCode.optional(),
  ref: guestId.optional(),
  test: z.boolean().optional(),
  key: key.optional(),
});
export type SessionReq = z.infer<typeof SessionReq>;

export const SessionRes = z.object({
  guestId,
  key: z.string(),
  token: z.string(),
  appKey: z.string(),
  area: z.string(),
  room: z
    .object({ code: roomCode, channelId: z.string(), name: z.string(), sport: z.string(), redirectedFrom: roomCode.optional() })
    .optional(),
});
export type SessionRes = z.infer<typeof SessionRes>;

export const CreateRoomReq = z.object({
  guestId,
  key,
  roomName: z.string().trim().min(1).max(ROOM_NAME_MAX),
  sport: z.enum(SPORTS),
  /** Optional scheduled start (ISO). */
  startsAt: z.iso.datetime().optional(),
  /** Creator room: one host, many fans. */
  creator: z.boolean().optional(),
});

export const AdminReq = z.discriminatedUnion("action", [
  z.object({ action: z.literal("feature"), code: roomCode, featured: z.boolean() }),
  z.object({ action: z.literal("anchor"), code: roomCode, label: z.string().trim().min(1).max(40), lagS: z.number().min(0).max(21_600) }),
  // text empty = ask the score provider (mock) for the current line.
  z.object({ action: z.literal("score"), code: roomCode, text: z.string().trim().max(40), lagS: z.number().min(0).max(21_600) }),
  z.object({ action: z.literal("stadium"), name: z.string().trim().min(1).max(ROOM_NAME_MAX), sport: z.enum(SPORTS), startsAt: z.iso.datetime().optional() }),
]);

export const METRIC_EVENTS = [
  "room_created",
  "joined",
  "message_sent",
  "message_locked",
  "revealed_on_time",
  "spoil_me",
  "call_started",
  "call_picked",
  "roar_sent",
  "lag_set",
  "sync_check_done",
  "replay_started",
  "wave_shared",
  "catchup_used",
  "feedback",
  "autosync_applied",
  "survey",
  "invite_opened",
  "recap_opened",
  "recap_shared",
  "paused",
  "moment_card_shared",
  "voice_sent",
] as const;

export const MetricsReq = z.object({
  guestId: guestId.optional(),
  events: z
    .array(
      z.object({
        name: z.enum(METRIC_EVENTS),
        roomCode: roomCode.optional(),
        props: z.record(z.string(), z.union([z.string().max(64), z.number(), z.boolean()])).optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const FeedbackReq = z.object({
  guestId,
  key,
  roomCode: roomCode.optional(),
  helpful: z.boolean(),
  comment: z.string().trim().max(500).optional(),
  spoiled: z.boolean().optional(),
  again: z.boolean().optional(),
});

export const ClientErrorReq = z.object({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
});

export const TryReq = z.object({
  guestId: guestId.optional(),
  name: displayName.optional(),
  avatar: avatar.optional(),
  test: z.boolean().optional(),
  key: key.optional(),
});
/** { guestId, key, code }: Judge Mode start, presence heartbeat. */
export const TryActionReq = z.object({ guestId, key, code: roomCode });
export const TryStepReq = z.object({ guestId, key, code: roomCode, step: z.number().int().min(0).max(30) });
export const ModerateReq = z.object({
  guestId,
  key,
  code: roomCode,
  targetId: z.string().max(64),
  // recall = delete a message for everyone; quiet/unquiet = only the host can post (Nexconn group freeze).
  action: z.enum(["mute", "remove", "recall", "quiet", "unquiet"]),
  messageId: z.string().min(1).max(64).optional(),
  sentAt: z.number().int().positive().optional(),
});
export const ReportReq = z.object({ guestId, key, code: roomCode, targetId: z.string().max(64), reason: z.string().trim().max(300).optional() });

export const DeleteDataReq = z.object({ guestId, key: key.optional() });

export const textMessage = z.string().trim().min(1).max(MESSAGE_MAX);

/** "What did I miss?": revealed messages only; the server re-checks each against `lag`. */
export const CatchupReq = z.object({
  guestId,
  key,
  code: roomCode,
  lag: z.number().min(0).max(MAX_LAG_MS),
  msgs: z
    .array(
      z.object({
        name: z.string().max(NAME_MAX),
        text: z.string().max(MESSAGE_MAX),
        matchTime: z.number().finite(),
        lagS: z.number().min(0).max(MAX_LAG_MS / 1000).optional(),
        event: z.boolean().optional(),
      }),
    )
    .max(CATCHUP_MAX_MSGS),
});
