import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, roomMembers, rooms } from "./db";
import { randomCode } from "./guard";
import { ROOM_CAP, type Sport } from "./config";
import { createGroup, joinGroup } from "./nexconn-server";

export type Room = typeof rooms.$inferSelect;

export const standName = (base: string, standIndex: number) =>
  standIndex === 0 ? base : `${base} · Stand ${String.fromCharCode(65 + standIndex)}`;

export async function getRoom(code: string): Promise<Room | null> {
  const [r] = await db().select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return r ?? null;
}

export async function createRoom(opts: {
  name: string;
  sport: Sport;
  owner: string;
  parentCode?: string;
  standIndex?: number;
  kind?: "room" | "try";
  /** Extra Nexconn members (Judge Mode bots). Not counted as room members. */
  extraMembers?: string[];
}): Promise<Room> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const channelId = `sb${code}`; // letters and digits only; Nexconn rejects some special characters
    if (await getRoom(code)) continue;
    await createGroup(channelId, opts.name, opts.owner, opts.extraMembers);
    const [room] = await db()
      .insert(rooms)
      .values({
        code,
        channelId,
        name: opts.name,
        sport: opts.sport,
        createdBy: opts.owner,
        parentCode: opts.parentCode ?? null,
        standIndex: opts.standIndex ?? 0,
        memberCount: 1,
        kind: opts.kind ?? "room",
      })
      .returning();
    await db().insert(roomMembers).values({ roomCode: code, userId: opts.owner }).onConflictDoNothing();
    return room;
  }
  throw new Error("could not allocate a room code");
}

export async function isMember(code: string, userId: string) {
  const [m] = await db()
    .select({ u: roomMembers.userId })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomCode, code), eq(roomMembers.userId, userId)))
    .limit(1);
  return !!m;
}

async function recordMember(room: Room, userId: string) {
  const inserted = await db().insert(roomMembers).values({ roomCode: room.code, userId }).onConflictDoNothing().returning();
  if (inserted.length) {
    await db().update(rooms).set({ memberCount: sql`${rooms.memberCount} + 1` }).where(eq(rooms.code, room.code));
  }
}

/**
 * Joins the user to the room, or to its overflow stand when full.
 * Returns the room the user actually ended up in.
 */
export async function joinRoom(code: string, userId: string, depth = 0): Promise<Room> {
  const room = await getRoom(code);
  if (!room) throw new Error("room not found");
  if (await isMember(room.code, userId)) {
    await joinGroup(room.channelId, userId); // idempotent; repairs drift if Nexconn lost the membership
    return room;
  }
  if (room.memberCount < ROOM_CAP && depth < 25) {
    const r = await joinGroup(room.channelId, userId);
    if (r !== "full") {
      await recordMember(room, userId);
      return room;
    }
  }
  // Full: go to the next stand of the same match (all stands share the root room's name).
  const root = room.parentCode ? ((await getRoom(room.parentCode)) ?? room) : room;
  const stands = await db().select().from(rooms).where(eq(rooms.parentCode, root.code)).orderBy(asc(rooms.standIndex));
  const next = stands.find((s) => s.standIndex > room.standIndex && s.memberCount < ROOM_CAP);
  if (next) return joinRoom(next.code, userId, depth + 1);
  const standIndex = Math.max(room.standIndex, ...stands.map((s) => s.standIndex)) + 1;
  const created = await createRoom({
    name: standName(root.name, standIndex),
    sport: root.sport as Sport,
    owner: userId,
    parentCode: root.code,
    standIndex,
  });
  return created;
}
