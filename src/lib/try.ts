import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, profiles, rooms } from "./db";
import { issueToken, sendGroupMessage } from "./nexconn-server";
import { createRoom, type Room } from "./rooms";
import { TEXT_TYPE, SB_TYPES, encodeTextExtra, sbContent } from "./transport/wire";
import { TRY_ANCHOR_LABEL, TRY_BOTS, TRY_CALL, TRY_STEPS, TRY_TEAMS, type BotKey, type TryStep } from "./try-script";

const BOT_LIST = Object.values(TRY_BOTS);
const readyBots = new Set<string>();

/** Bots are real Nexconn users (issuing a token registers them), flagged is_bot so /stats leaves them out. */
export async function ensureBotUsers(list: readonly { id: string; name: string; avatar: string }[]) {
  const todo = list.filter((b) => !readyBots.has(b.id));
  if (!todo.length) return;
  const have = await db().select({ id: profiles.id }).from(profiles).where(inArray(profiles.id, todo.map((b) => b.id)));
  for (const b of todo) {
    if (!have.some((h) => h.id === b.id)) {
      await issueToken(b.id, b.name);
      await db().insert(profiles).values({ id: b.id, name: b.name, avatar: b.avatar, isBot: true }).onConflictDoNothing();
    }
    readyBots.add(b.id);
  }
}
const ensureBots = () => ensureBotUsers(BOT_LIST);

export async function createTryRoom(owner: string): Promise<Room> {
  await ensureBots();
  return createRoom({
    name: `${TRY_TEAMS.bowl} vs ${TRY_TEAMS.bat} · Demo`,
    sport: "cricket",
    owner,
    kind: "try",
    extraMembers: BOT_LIST.map((b) => b.id),
  });
}

function botSend(bot: BotKey, channelId: string, kind: "text" | "roar" | "anchor", data: { text?: string; intensity?: 1 | 2 | 3 }) {
  const b = TRY_BOTS[bot];
  // Same metadata as client messages; bots watch the fastest feed (lag 0).
  if (kind === "text") return sendGroupMessage(b.id, channelId, TEXT_TYPE, { content: data.text, extra: encodeTextExtra(0, b.name, b.avatar) });
  if (kind === "roar") return sendGroupMessage(b.id, channelId, SB_TYPES.roar, sbContent("roar", { lag: 0, intensity: data.intensity ?? 3, dur: 1500, n: b.name, a: b.avatar }));
  return sendGroupMessage(b.id, channelId, SB_TYPES.anchor, sbContent("anchor", { lag: 0, label: TRY_ANCHOR_LABEL, n: b.name, a: b.avatar }));
}

/** Call it steps, stamped like client messages (bots watch at lag 0). */
function botCall(s: Extract<TryStep, { kind: "call" | "callvote" | "callresult" }>, channelId: string) {
  const b = TRY_BOTS[s.bot];
  const who = { lag: 0, callId: TRY_CALL.callId, n: b.name, a: b.avatar };
  if (s.kind === "call") return sendGroupMessage(b.id, channelId, SB_TYPES.call, sbContent("call", { ...who, q: TRY_CALL.q, opts: TRY_CALL.opts }));
  if (s.kind === "callvote") return sendGroupMessage(b.id, channelId, SB_TYPES.callvote, sbContent("callvote", { ...who, pick: s.pick }));
  return sendGroupMessage(b.id, channelId, SB_TYPES.callresult, sbContent("callresult", { ...who, answer: s.answer }));
}

/** Starts the over once: sets the first-ball time and posts the anchor every window syncs to. */
export async function startTry(room: Room): Promise<void> {
  const [won] = await db()
    .update(rooms)
    .set({ startsAt: new Date() })
    .where(and(eq(rooms.code, room.code), isNull(rooms.startsAt)))
    .returning({ code: rooms.code });
  if (!won) return; // already started
  try {
    await botSend("arjun", room.channelId, "anchor", {});
  } catch (e) {
    await db().update(rooms).set({ startsAt: null }).where(eq(rooms.code, room.code));
    throw e;
  }
}

const EARLY_MS = 2000; // client clocks can run slightly ahead

/** Sends one scripted bot step, at most once, and not before its time. Returns false if too early. */
export async function sendTryStep(room: Room, step: number): Promise<"sent" | "already" | "early"> {
  const s = TRY_STEPS[step];
  if (!room.startsAt || Date.now() < room.startsAt.getTime() + s.t * 1000 - EARLY_MS) return "early";
  const bit = 1 << step;
  const [claimed] = await db()
    .update(rooms)
    .set({ trySteps: sql`${rooms.trySteps} | ${bit}` })
    .where(and(eq(rooms.code, room.code), sql`(${rooms.trySteps} & ${bit}) = 0`))
    .returning({ code: rooms.code });
  if (!claimed) return "already";
  try {
    await (s.kind === "text" || s.kind === "roar" ? botSend(s.bot, room.channelId, s.kind, s.kind === "text" ? { text: s.text } : { intensity: s.intensity }) : botCall(s, room.channelId));
    return "sent";
  } catch (e) {
    await db().update(rooms).set({ trySteps: sql`${rooms.trySteps} & ~${bit}` }).where(eq(rooms.code, room.code));
    throw e;
  }
}
