import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";

// Real usage only. Test and bot profiles are excluded everywhere, and room-level numbers
// (messages, spoilers, roars) come from real rooms only: Judge Mode demo rooms are left out,
// so "spoilers blocked" can never count bot messages that "messages" doesn't.
const REAL = sql`not coalesce(p.is_test, false) and not coalesce(p.is_bot, false)`;
const REAL_ROOM_CODES = sql`(select code from rooms where kind <> 'try')`;
const REAL_ROOM_CHANNELS = sql`(select channel_id from rooms where kind <> 'try')`;
const IST_DAY = (col: ReturnType<typeof sql>) => sql`((${col}) at time zone 'Asia/Kolkata')::date`;

export interface Totals {
  since: string | null;
  users: number;
  rooms: number;
  rooms_2plus: number;
  messages: number;
  spoilers: number;
  roars: number;
  watch_parties: number;
  srv_rows: number;
  lag_spread_ms: number | null;
}

/** Real messages per (room, user, time): webhook rows when we have them, else in-app events. */
const MSG_ROWS = sql`
  select r.code as room, m.user_id, m.sent_at as at
  from nc_messages m join rooms r on r.channel_id = m.channel_id left join profiles p on p.id = m.user_id
  where r.kind <> 'try' and ${REAL} and m.message_type = 'RC:TxtMsg'
  union all
  select e.room_code, e.user_id, e.created_at
  from events e
  where e.name = 'message_sent' and not e.is_test and e.room_code in ${REAL_ROOM_CODES}
    and not exists (select 1 from nc_messages)
`;

export async function getTotals(): Promise<Totals> {
  const res = await db().execute(sql`
    with srv as (select count(*)::int as n from nc_messages m left join profiles p on p.id = m.user_id where ${REAL})
    select
      (select to_char(${IST_DAY(sql`min(created_at)`)}, 'YYYY-MM-DD') from events where not is_test) as since,
      (select count(distinct user_id) from events where name = 'joined' and not is_test)::int as users,
      (select count(*) from rooms r join profiles p on p.id = r.created_by where ${REAL} and r.kind <> 'try')::int as rooms,
      (
        select count(*) from (
          select rm.room_code from room_members rm join profiles p on p.id = rm.user_id
          where ${REAL} and rm.room_code in ${REAL_ROOM_CODES}
          group by rm.room_code having count(*) >= 2
        ) x
      )::int as rooms_2plus,
      case when (select n from srv) > 0
        then (select count(*) from nc_messages m left join profiles p on p.id = m.user_id where ${REAL} and m.message_type = 'RC:TxtMsg' and m.channel_id in ${REAL_ROOM_CHANNELS})
        else (select count(*) from events where name = 'message_sent' and not is_test and room_code in ${REAL_ROOM_CODES})
      end::int as messages,
      (select count(*) from events where name = 'revealed_on_time' and not is_test and room_code in ${REAL_ROOM_CODES})::int as spoilers,
      case when (select n from srv) > 0
        then (select count(*) from nc_messages m left join profiles p on p.id = m.user_id where ${REAL} and m.message_type = 'SB:Roar' and m.channel_id in ${REAL_ROOM_CHANNELS})
        else (select count(*) from events where name = 'roar_sent' and not is_test and room_code in ${REAL_ROOM_CODES})
      end::int as roars,
      (
        select count(*) from (
          select room, ${IST_DAY(sql`at`)} from (${MSG_ROWS}) x
          group by 1, 2 having count(distinct user_id) >= 2
        ) y
      )::int as watch_parties,
      (select n from srv) as srv_rows,
      (
        with latest as (
          select distinct on (m.channel_id, m.user_id) m.channel_id, m.lag
          from nc_messages m left join profiles p on p.id = m.user_id
          where m.lag is not null and ${REAL} and m.channel_id in ${REAL_ROOM_CHANNELS}
          order by m.channel_id, m.user_id, m.sent_at desc
        ),
        spreads as (select max(lag) - min(lag) as s from latest group by channel_id having count(*) >= 2)
        select percentile_cont(0.5) within group (order by s) from spreads
      )::float as lag_spread_ms
  `);
  return res.rows[0] as unknown as Totals;
}

export interface Day {
  day: string;
  users: number;
  rooms: number;
  messages: number;
  spoilers: number;
}

/** Per IST day: active real users (any in-app event or server-seen message), rooms created, messages, spoilers held. */
export async function getDays(days?: number): Promise<Day[]> {
  const from = days
    ? sql`(now() at time zone 'Asia/Kolkata')::date - ${days - 1}::int`
    : sql`coalesce((select ${IST_DAY(sql`min(created_at)`)} from events where not is_test), (now() at time zone 'Asia/Kolkata')::date)`;
  const res = await db().execute(sql`
    with acts as (
      select user_id, created_at as at from events where not is_test and user_id is not null
      union all
      select m.user_id, m.sent_at from nc_messages m left join profiles p on p.id = m.user_id where ${REAL}
    ),
    d as (select generate_series(${from}, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day)
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      (select count(distinct user_id) from acts where ${IST_DAY(sql`acts.at`)} = d.day)::int as users,
      (select count(*) from rooms r join profiles p on p.id = r.created_by where ${REAL} and r.kind <> 'try' and ${IST_DAY(sql`r.created_at`)} = d.day)::int as rooms,
      (select count(*) from (${MSG_ROWS}) x where ${IST_DAY(sql`x.at`)} = d.day)::int as messages,
      (select count(*) from events e where e.name = 'revealed_on_time' and not e.is_test and e.room_code in ${REAL_ROOM_CODES} and ${IST_DAY(sql`e.created_at`)} = d.day)::int as spoilers
    from d order by d.day
  `);
  return res.rows as unknown as Day[];
}

export const toCsv = (rows: Day[]) =>
  ["day,real_users,rooms_created,messages,spoilers_held", ...rows.map((r) => [r.day, r.users, r.rooms, r.messages, r.spoilers].join(","))].join("\n") + "\n";
