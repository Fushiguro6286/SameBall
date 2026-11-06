import "server-only";
import { checkKey } from "@/lib/auth";
import { fail } from "@/lib/http";
import { getRoom, isMember, type Room } from "@/lib/rooms";

/** The Judge Mode room, if the caller is a member of it; otherwise an error Response. */
export async function loadTryRoom(code: string, guestId: string, key: string): Promise<Room | Response> {
  if (!checkKey(guestId, key)) return fail(401, "bad_key");
  const room = await getRoom(code);
  if (!room || room.kind !== "try") return fail(404, "room_not_found");
  if (!(await isMember(code, guestId))) return fail(403, "not_member");
  return room;
}
