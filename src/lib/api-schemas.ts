import { z } from "zod";
import { AVATARS, MESSAGE_MAX, NAME_MAX, ROOM_NAME_MAX, SPORTS } from "./config";

const guestId = z.string().regex(/^g_[A-Za-z0-9]{20}$/);
const roomCode = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const displayName = z.string().trim().min(1).max(NAME_MAX);
const avatar = z.enum(AVATARS);

export const SessionReq = z.object({
  guestId: guestId.optional(),
  name: displayName,
  avatar,
  roomCode: roomCode.optional(),
  ref: guestId.optional(),
  test: z.boolean().optional(),
});
export type SessionReq = z.infer<typeof SessionReq>;

export const SessionRes = z.object({
  guestId,
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
  roomName: z.string().trim().min(1).max(ROOM_NAME_MAX),
  sport: z.enum(SPORTS),
});

export const METRIC_EVENTS = [
  "room_created",
  "joined",
  "message_sent",
  "message_locked",
  "revealed_on_time",
  "spoil_me",
  "roar_sent",
  "lag_set",
  "sync_check_done",
  "replay_started",
  "wave_shared",
  "feedback",
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
  roomCode: roomCode.optional(),
  helpful: z.boolean(),
  comment: z.string().trim().max(500).optional(),
});

export const ClientErrorReq = z.object({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
});

export const DeleteDataReq = z.object({ guestId });

export const textMessage = z.string().trim().min(1).max(MESSAGE_MAX);
