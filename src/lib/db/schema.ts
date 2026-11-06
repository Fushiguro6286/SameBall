// Postgres stores rooms, profiles, metrics and feedback only. Chat lives in Nexconn.
import { bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // guest id, also the Nexconn user id
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  isBot: boolean("is_bot").notNull().default(false),
  isTest: boolean("is_test").notNull().default(false),
  referrer: text("referrer"),
  keyed: boolean("keyed").notNull().default(false), // once a guest key was issued, every call must carry it
  createdAt: ts("created_at"),
  lastSeenAt: ts("last_seen_at"),
});

export const rooms = pgTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    channelId: text("channel_id").notNull().unique(),
    name: text("name").notNull(),
    sport: text("sport").notNull(),
    createdBy: text("created_by").notNull(),
    parentCode: text("parent_code"), // overflow "Stand B" rooms point at the original
    standIndex: integer("stand_index").notNull().default(0),
    memberCount: integer("member_count").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }), // scheduled start; for Judge Mode rooms, the first ball
    kind: text("kind").notNull().default("room"), // "room" | "try" (Judge Mode demo)
    trySteps: integer("try_steps").notNull().default(0), // bitmask of Judge Mode bot steps already sent
    createdAt: ts("created_at"),
  },
  (t) => [index("rooms_parent_idx").on(t.parentCode)],
);

export const roomMembers = pgTable(
  "room_members",
  {
    roomCode: text("room_code").notNull(),
    userId: text("user_id").notNull(),
    joinedAt: ts("joined_at"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }), // "watching now" heartbeat
    removedAt: timestamp("removed_at", { withTimezone: true }), // removed by the room creator; can't rejoin
  },
  (t) => [primaryKey({ columns: [t.roomCode, t.userId] }), index("room_members_user_idx").on(t.userId)],
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    userId: text("user_id"),
    roomCode: text("room_code"),
    props: jsonb("props"),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: ts("created_at"),
  },
  (t) => [index("events_name_idx").on(t.name, t.createdAt)],
);

export const feedback = pgTable("feedback", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull(),
  roomCode: text("room_code"),
  helpful: boolean("helpful").notNull(),
  comment: text("comment"),
  createdAt: ts("created_at"),
});

export const reports = pgTable("reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reporterId: text("reporter_id").notNull(),
  targetId: text("target_id").notNull(),
  roomCode: text("room_code").notNull(),
  reason: text("reason"),
  createdAt: ts("created_at"),
});
