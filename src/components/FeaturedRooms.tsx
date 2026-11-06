import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, rooms } from "@/lib/db";
import { FeaturedList } from "./FeaturedList";

/** Featured rooms (set in /admin), so new visitors can drop straight into a live match room. */
async function loadFeatured() {
  const list = await db()
    .select({ code: rooms.code, name: rooms.name, sport: rooms.sport, kind: rooms.kind, startsAt: rooms.startsAt })
    .from(rooms)
    .where(and(eq(rooms.featured, true), inArray(rooms.kind, ["room", "stadium"])))
    .orderBy(sql`${rooms.startsAt} asc nulls first`, asc(rooms.createdAt))
    .limit(6)
    .catch(() => []);
  return { list, now: Date.now() };
}

export async function FeaturedRooms() {
  await connection();
  const { list, now } = await loadFeatured();
  if (!list.length) return null;
  return <FeaturedList list={list.map((r) => ({ ...r, startsAt: r.startsAt?.getTime() ?? null }))} now={now} />;
}
