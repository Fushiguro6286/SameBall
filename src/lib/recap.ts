import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { getRoom } from "./rooms";

// Squad recap for a room: counts and names only, never message content, so it can't spoil anything.
// Test and bot users are left out, like everywhere else.
const REAL = sql`not coalesce(p.is_test, false) and not coalesce(p.is_bot, false)`;

export interface Recap {
  code: string;
  name: string;
  sport: string;
  fans: number;
  messages: number;
  spoilers: number;
  roars: number;
  topRoarer: { name: string; avatar: string; roars: number } | null;
  /** Biggest gap between the fastest and slowest screen, seconds. */
  spreadS: number | null;
  slowest: { name: string; avatar: string; lagS: number } | null;
}

export async function getRecap(code: string): Promise<Recap | null> {
  const room = await getRoom(code);
  if (!room || room.kind === "try") return null;
  const ch = room.channelId;
  const res = await db().execute(sql`
    with srv as (select count(*)::int as n from nc_messages where channel_id = ${ch}),
    lags as (
      select distinct on (m.user_id) m.user_id, m.lag, p.name, p.avatar
      from nc_messages m join profiles p on p.id = m.user_id
      where m.channel_id = ${ch} and m.lag is not null and m.lag <= 21600000 and ${REAL}
      order by m.user_id, m.sent_at desc
    ),
    roarers as (
      select p.name, p.avatar, count(*)::int as roars
      from nc_messages m join profiles p on p.id = m.user_id
      where m.channel_id = ${ch} and m.message_type = 'SB:Roar' and ${REAL}
      group by p.id, p.name, p.avatar
      union all
      select p.name, p.avatar, count(*)::int
      from events e join profiles p on p.id = e.user_id
      where e.room_code = ${code} and e.name = 'roar_sent' and not e.is_test and (select n from srv) = 0
      group by p.id, p.name, p.avatar
    )
    select
      (select count(*) from room_members rm join profiles p on p.id = rm.user_id where rm.room_code = ${code} and rm.removed_at is null and ${REAL})::int as fans,
      case when (select n from srv) > 0
        then (select count(*) from nc_messages m join profiles p on p.id = m.user_id where m.channel_id = ${ch} and m.message_type in ('RC:TxtMsg', 'RC:HQVCMsg') and ${REAL})
        else (select count(*) from events where room_code = ${code} and name = 'message_sent' and not is_test)
      end::int as messages,
      (select count(*) from events where room_code = ${code} and name = 'revealed_on_time' and not is_test)::int as spoilers,
      (select coalesce(sum(roars), 0) from roarers)::int as roars,
      (select json_build_object('name', name, 'avatar', avatar, 'roars', roars) from roarers order by roars desc limit 1) as top_roarer,
      (select case when count(*) >= 2 then round((max(lag) - min(lag)) / 1000.0) end from lags)::int as spread_s,
      (select json_build_object('name', name, 'avatar', avatar, 'lagS', round(lag / 1000.0)) from lags where (select count(*) from lags) >= 2 order by lag desc limit 1) as slowest
  `);
  const r = res.rows[0] as { fans: number; messages: number; spoilers: number; roars: number; top_roarer: Recap["topRoarer"]; spread_s: number | null; slowest: Recap["slowest"] };
  return {
    code: room.code,
    name: room.name,
    sport: room.sport,
    fans: r.fans,
    messages: r.messages,
    spoilers: r.spoilers,
    roars: r.roars,
    topRoarer: r.top_roarer,
    spreadS: r.spread_s,
    slowest: r.slowest,
  };
}
