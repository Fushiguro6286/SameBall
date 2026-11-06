import "server-only";
import { timingSafeEqual } from "node:crypto";
import { joinGroup, sendGroupMessage } from "./nexconn-server";
import type { Room } from "./rooms";
import { ensureBotUsers } from "./try";
import { SB_TYPES, sbContent } from "./transport/wire";

/** Posts anchors for the admin. A real Nexconn user flagged is_bot. */
export const HOST_BOT = { id: "bot_sameball_host", name: "SameBall", avatar: "🏟️" } as const;

/** Bearer ADMIN_TOKEN check. Admin is off when the token isn't set. */
export function isAdmin(req: Request): boolean {
  const want = process.env.ADMIN_TOKEN;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!want || !got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** An anchor marks a match moment; lag is the admin's own feed delay so its match time is right. */
export async function postAnchor(room: Room, label: string, lagMs: number) {
  await ensureBotUsers([HOST_BOT]);
  await joinGroup(room.channelId, HOST_BOT.id);
  await sendGroupMessage(HOST_BOT.id, room.channelId, SB_TYPES.anchor, sbContent("anchor", { lag: lagMs, label, n: HOST_BOT.name, a: HOST_BOT.avatar }));
}
