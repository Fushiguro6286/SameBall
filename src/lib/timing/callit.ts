// "Call it": fair-play predictions. Someone asks ("Next ball?"), everyone picks before the moment
// reaches their own screen, and the asker posts the answer once it has happened on theirs.
//
// Fairness comes from match time (sentTime − lag): a pick counts only if its match time is before the
// deadline. A friend on a slow feed has until the ball reaches *their* screen; a friend on a fast feed
// can't pick after seeing it. The deadline is the asker's "Lock picks" moment (bowler running in), or
// failing that the answer's match time minus a reaction margin (the asker answers a moment after seeing it).
// Spoiler safety: the question, other people's picks and the answer only show once revealed for me.

import { matchTime, type ChatMsg } from "./engine";

export const CALL_MAX_OPTS = 5;
/** Wire value of `answer` that means "picks locked", not an answer. */
export const CALL_LOCK = -1;
export const ANSWER_GRACE_MS = 3000;

export interface Caller {
  senderId: string;
  name: string;
  avatar: string;
}
export interface CallState {
  callId: string;
  q: string;
  opts: string[];
  askedBy: Caller;
  sentTime: number;
  /** My counted pick (or my latest pick while the call is open). */
  mine: number | null;
  /** People whose pick I can see (revealed for me), me included. */
  pickers: number;
  /** The answer, once it's revealed for me. */
  answer: number | null;
  /** True once an answer exists, revealed or not: the asker can't answer twice. */
  answered: boolean;
  /** Picks are closed for me: the asker's lock (or answer) has reached my screen. */
  closed: boolean;
  /** Who called it right, once the answer is revealed for me. */
  winners: Caller[];
}
export interface CallPoints extends Caller {
  points: number;
}

const who = (m: ChatMsg): Caller => ({ senderId: m.senderId, name: m.senderName, avatar: m.avatar });

/** Each sender's counted pick: their latest pick made before the answer's match time (any time if unanswered). */
function countedPicks(votes: ChatMsg[], deadline: number | null): Map<string, ChatMsg> {
  const out = new Map<string, ChatMsg>();
  for (const v of votes) {
    if (deadline !== null && matchTime(v) >= deadline) continue;
    const prev = out.get(v.senderId);
    if (!prev || v.sentTime >= prev.sentTime) out.set(v.senderId, v);
  }
  return out;
}

export function callsOf(all: ChatMsg[], isRevealed: (id: string) => boolean, myId: string): { current: CallState | null; board: CallPoints[] } {
  const calls = all.filter((m) => m.kind === "call" && isRevealed(m.id)).sort((a, b) => a.sentTime - b.sentTime);
  const board = new Map<string, CallPoints>();
  let current: CallState | null = null;

  for (const c of calls) {
    const callId = String(c.payload?.callId ?? "");
    const opts = (c.payload?.opts as string[] | undefined) ?? [];
    // Only the asker can lock or answer; the earliest of each wins.
    const mine = all.filter((m) => m.kind === "callresult" && m.senderId === c.senderId && m.payload?.callId === callId).sort((a, b) => a.sentTime - b.sentTime);
    const lock = mine.find((m) => m.payload?.answer === CALL_LOCK);
    const result = mine.find((m) => m.payload?.answer !== CALL_LOCK);
    const cutoffs = [lock && matchTime(lock), result && matchTime(result) - ANSWER_GRACE_MS].filter((x): x is number => typeof x === "number");
    const deadline = cutoffs.length ? Math.min(...cutoffs) : null;
    const picks = countedPicks(
      all.filter((m) => m.kind === "callvote" && m.payload?.callId === callId),
      deadline,
    );
    const answer = result && isRevealed(result.id) ? Number(result.payload?.answer) : null;
    const winners = answer === null ? [] : [...picks.values()].filter((v) => Number(v.payload?.pick) === answer).map(who);
    for (const w of winners) {
      const p = board.get(w.senderId) ?? { ...w, points: 0 };
      p.points += 1;
      board.set(w.senderId, p);
    }
    const myPick = picks.get(myId);
    current = {
      callId,
      q: String(c.payload?.q ?? ""),
      opts,
      askedBy: who(c),
      sentTime: c.sentTime,
      mine: myPick ? Number(myPick.payload?.pick) : null,
      pickers: [...picks.values()].filter((v) => v.senderId === myId || isRevealed(v.id)).length,
      answer,
      answered: !!result,
      closed: [lock, result].some((m) => m && isRevealed(m.id)),
      winners,
    };
  }
  return { current, board: [...board.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)) };
}
