import "server-only";
import { timingSafeEqual } from "node:crypto";
import { STADIUM_STANDS, type Sport } from "./config";
import { joinGroup, sendCommunityMessage, sendGroupMessage } from "./nexconn-server";
import { createRoom, type Room } from "./rooms";
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
  const content = sbContent("anchor", { lag: lagMs, label, n: HOST_BOT.name, a: HOST_BOT.avatar });
  if (room.kind === "stadium") {
    // Anchors are schedule markers, so every stand gets one. The host bot created the community, so it's a member.
    for (const stand of STADIUM_STANDS) await sendCommunityMessage(HOST_BOT.id, room.channelId, stand, SB_TYPES.anchor, content);
    return;
  }
  await joinGroup(room.channelId, HOST_BOT.id);
  await sendGroupMessage(HOST_BOT.id, room.channelId, SB_TYPES.anchor, content);
}

/** Live score line from the host bot. lag = the admin's feed delay (0 for a provider), so each screen shows it on time. */
export async function postScore(room: Room, s: string, lagMs: number) {
  await ensureBotUsers([HOST_BOT]);
  const content = sbContent("score", { lag: lagMs, s, n: HOST_BOT.name, a: HOST_BOT.avatar });
  if (room.kind === "stadium") {
    for (const stand of STADIUM_STANDS) await sendCommunityMessage(HOST_BOT.id, room.channelId, stand, SB_TYPES.score, content);
    return;
  }
  await joinGroup(room.channelId, HOST_BOT.id);
  await sendGroupMessage(HOST_BOT.id, room.channelId, SB_TYPES.score, content);
}

/** A featured public match room on a community channel, owned by the host bot. */
export async function createStadium(name: string, sport: Sport, startsAt?: Date) {
  await ensureBotUsers([HOST_BOT]);
  return createRoom({ name, sport, owner: HOST_BOT.id, kind: "stadium", featured: true, startsAt });
}
