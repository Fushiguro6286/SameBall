// Series league: Call it points across every match a squad watches in one room, reset when the room creator
// starts a new series (an anchor whose label starts with 🏆). Built from Nexconn history, so nothing extra is
// stored. Same spoiler rule as Call it: only what's revealed for me counts.

import { callsOf, type CallPoints } from "./callit";
import { compareMsgs, type ChatMsg } from "./engine";

export const SERIES_PREFIX = "🏆 ";

export interface League {
  /** Current series name (null = no series started yet: everything so far counts). */
  series: string | null;
  board: CallPoints[];
  /** Top scorer of the previous series, if anyone scored. */
  champion: { series: string; who: CallPoints } | null;
}

export function leagueOf(all: ChatMsg[], isRevealed: (id: string) => boolean, myId: string, ownerId?: string): League {
  const msgs = [...all].sort(compareMsgs);
  const starts = msgs.filter(
    (m) =>
      m.kind === "anchor" &&
      String(m.payload?.label ?? "").startsWith(SERIES_PREFIX) &&
      (m.senderId === ownerId || m.senderId.startsWith("bot_")) &&
      isRevealed(m.id),
  );
  const cur = starts.at(-1);
  const prev = starts.at(-2);
  const label = (m: ChatMsg) => String(m.payload?.label ?? "").slice(SERIES_PREFIX.length);
  const board = callsOf(cur ? msgs.filter((m) => compareMsgs(m, cur) > 0) : msgs, isRevealed, myId).board;
  const before = cur ? msgs.filter((m) => compareMsgs(m, cur) < 0 && (!prev || compareMsgs(m, prev) > 0)) : [];
  const top = before.length ? callsOf(before, isRevealed, myId).board[0] : undefined;
  return {
    series: cur ? label(cur) : null,
    board,
    champion: cur && top && top.points > 0 ? { series: prev ? label(prev) : "", who: top } : null,
  };
}
