"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HISTORY_PAGES, HISTORY_PAGES_REPLAY } from "../config";
import { fetchServerTime } from "../client/api";
import { track } from "../client/metrics";
import { saveRoomPrefs } from "../client/storage";
import { observe, type Observation } from "../timing/autosync";
import { measureOffset } from "../timing/clock";
import { LIVE_MAX_LAG_MS, MAX_LAG_MS, matchTime, revealAt, type ChatMsg } from "../timing/engine";
import type { Pending } from "../timing/hype";
import type { Tap } from "../timing/sync-solver";
import { callsOf, type CallPoints, type CallState } from "../timing/callit";
import { RoomStore, type ViewItem } from "../timing/room-store";
import { findMoments, type Moment } from "../timing/wave";
import { createLocalTransport } from "../transport/local";
import { createNexconnTransport } from "../transport/nexconn";
import type { ConnState, Transport } from "../transport/types";
import { RawMsg, SB_TYPES, encodeTextExtra, parseIncoming, sbContent, type SbPayload } from "../transport/wire";

export interface RoomSession {
  code: string;
  channelId: string;
  guestId: string;
  /** Server-issued guest key (absent in demo mode). */
  key?: string;
  name: string;
  avatar: string;
  demo: boolean;
  token?: string;
  appKey?: string;
  area?: string;
  /** Stadium stand (community sub-channel id); absent for normal rooms. */
  stand?: string;
  /** Second-screen windows don't overwrite this browser's saved lag. */
  ephemeral?: boolean;
}

export type RoomStatus = ConnState | "failed";

const CLOCK_REFRESH_MS = 5 * 60_000;

interface Snapshot {
  view: ViewItem[];
  lockedCount: number;
  lagMs: number;
  pending: Pending[];
  anchors: Anchor[];
  lags: MemberLag[];
  sync: SyncState | null;
  paused: boolean;
  /** Match time of the first text message, the replay fallback when a room has no anchors. */
  firstAt: number | null;
  /** Big moments, from reactions already revealed for me (so never ahead of my screen). */
  moments: Moment[];
  /** Auto-sync: my reactions vs the fastest friend's, from revealed messages only. */
  syncObs: Observation[];
  /** Call it: the latest prediction and the room's points (both only from what's revealed for me). */
  call: CallState | null;
  callBoard: CallPoints[];
}
/** The latest Sync Check and its taps. Control messages, readable even while locked. */
export interface SyncState {
  checkId: string;
  label: string;
  startedBy: string;
  startedAt: number;
  taps: Tap[];
}
function syncOf(st: RoomStore): SyncState | null {
  const all = st.all();
  const check = all.filter((m) => m.kind === "synccheck").sort((a, b) => a.sentTime - b.sentTime).at(-1);
  if (!check) return null;
  const checkId = String(check.payload?.checkId ?? "");
  return {
    checkId,
    label: String(check.payload?.label ?? ""),
    startedBy: check.senderName,
    startedAt: check.sentTime,
    taps: all
      .filter((m) => m.kind === "synctap" && m.payload?.checkId === checkId)
      .map((m) => ({ senderId: m.senderId, sentTime: m.sentTime, lag: m.lag ?? 0 })),
  };
}
/** Each member's latest lag stamp, for the Lag Leaderboard and The Wave. Anchors are left out so the host bot isn't a "member". */
export interface MemberLag {
  senderId: string;
  name: string;
  avatar: string;
  lag: number;
}
function lagsOf(st: RoomStore): MemberLag[] {
  const latest = new Map<string, MemberLag>();
  for (const m of st.all()) if (m.lag !== null && m.lag <= LIVE_MAX_LAG_MS && m.kind !== "anchor") latest.set(m.senderId, { senderId: m.senderId, name: m.senderName, avatar: m.avatar, lag: m.lag });
  return [...latest.values()];
}
/** Anchors are schedule markers ("First ball"), not chat content, so they are readable even while locked. */
export interface Anchor {
  id: string;
  label: string;
  matchTime: number;
  senderId: string;
}
const anchorsOf = (st: RoomStore): Anchor[] =>
  st
    .all()
    .filter((m) => m.kind === "anchor")
    .map((m) => ({ id: m.id, label: String(m.payload?.label ?? ""), matchTime: matchTime(m), senderId: m.senderId }));
const snapshot = (st: RoomStore, myId: string): Snapshot => ({
  ...((c) => ({ call: c.current, callBoard: c.board }))(callsOf(st.all(), (id) => st.isRevealed(id), myId)),
  view: st.view(),
  lockedCount: st.lockedCount(),
  lagMs: st.effectiveLag(),
  pending: st.pending(),
  anchors: anchorsOf(st),
  lags: lagsOf(st),
  sync: syncOf(st),
  paused: st.paused,
  firstAt: ((m) => (m ? matchTime(m) : null))(st.all().find((m) => m.kind === "text")),
  ...((revealed) => ({ moments: findMoments(revealed), syncObs: observe(revealed, myId) }))(st.all().filter((m) => st.isRevealed(m.id))),
});

/** A roar that just reached my screen. */
export interface RoarHit {
  id: string;
  senderId: string;
  intensity: number;
  dur: number;
}
const ROAR_FRESH_MS = 4000; // older roars (history, late arrivals) stay silent

/** `replay` (Ghost Crowd): start with everything locked until the viewer syncs to an anchor; no lag announcements or spoiler metrics. */
export function useRoom(s: RoomSession, initialLagMs: number, initialSource: string, onRoar?: (r: RoarHit) => void, replay = false) {
  const startLag = replay ? MAX_LAG_MS : initialLagMs;
  const onRoarRef = useRef(onRoar);
  useEffect(() => {
    onRoarRef.current = onRoar;
  });
  const playedRef = useRef(new Set<string>());
  const storeRef = useRef<RoomStore | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const sourceRef = useRef(initialSource);
  const lagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitRoarsRef = useRef<(msgs: ChatMsg[]) => void>(() => {});
  const nowRef = useRef(() => Date.now());
  const [snap, setSnap] = useState<Snapshot>({
    view: [],
    lockedCount: 0,
    lagMs: startLag,
    pending: [],
    anchors: [],
    lags: [],
    sync: null,
    paused: false,
    firstAt: null,
    moments: [],
    syncObs: [],
    call: null,
    callBoard: [],
  });
  const [heldBack, setHeldBack] = useState(0);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    let disposed = false;
    let offset = 0;
    const now = () => Date.now() + offset;
    nowRef.current = now;
    const offs: (() => void)[] = [];

    const noteVisible = (msgs: ChatMsg[]) => {
      const others = msgs.filter((m) => m.kind === "text" && m.senderId !== s.guestId);
      if (!others.length) return;
      const last = others[others.length - 1];
      setAnnounce(`${last.senderName}: ${last.text ?? ""}`);
      if (document.visibilityState === "hidden") setUnseen((n) => n + others.length);
    };

    const store: RoomStore = new RoomStore(s.guestId, startLag, now, {
      // Replays would count every old message as a "spoiler blocked", so they track nothing here.
      onLocked: (m) => !replay && m.kind === "text" && track("message_locked", s.code),
      onRevealed: (msgs, how) => {
        if (!replay) for (const m of msgs) if (m.kind === "text") track(how === "spoil" ? "spoil_me" : "revealed_on_time", s.code);
        if (how === "schedule") {
          const held = msgs.filter((m) => m.kind === "text" && m.senderId !== s.guestId).length;
          if (held && !disposed) setHeldBack((n) => n + held);
        }
        noteVisible(msgs);
        if (how === "schedule") emitRoars(msgs);
      },
      onChange: () => !disposed && setSnap(snapshot(store, s.guestId)),
    });
    storeRef.current = store;
    emitRoarsRef.current = (msgs) => emitRoars(msgs);

    function emitRoars(msgs: ChatMsg[]) {
      const t = now();
      const lag = store.effectiveLag();
      for (const m of msgs) {
        if (m.kind !== "roar" || playedRef.current.has(m.id)) continue;
        if (t - (m.senderId === s.guestId ? m.sentTime : revealAt(m, lag)) > ROAR_FRESH_MS) continue;
        playedRef.current.add(m.id);
        onRoarRef.current?.({ id: m.id, senderId: m.senderId, intensity: Number(m.payload?.intensity) || 1, dur: Number(m.payload?.dur) || 1500 });
      }
    }

    const ingest = (raws: RawMsg[]) => {
      const parsed = raws.map(parseIncoming).filter((m): m is ChatMsg => !!m);
      const fresh = parsed.filter((m) => !store.get(m.id));
      store.add(parsed);
      const visible = fresh.filter((m) => store.isRevealed(m.id));
      noteVisible(visible);
      emitRoars(visible);
    };

    const transport =
      s.demo || !s.token
        ? createLocalTransport({ roomCode: s.code, userId: s.guestId })
        : createNexconnTransport({ appKey: s.appKey!, area: s.area ?? "SG", token: s.token, userId: s.guestId, channelId: s.channelId, subChannelId: s.stand });
    transportRef.current = transport;

    const syncClock = async () => {
      offset = await measureOffset(fetchServerTime);
      if (disposed) return;
      setClockOffset(Math.round(offset));
      store.clockChanged();
    };

    const loadHistory = async () => {
      const raws = await transport.loadHistory(replay ? HISTORY_PAGES_REPLAY : HISTORY_PAGES);
      if (!disposed) store.add(raws.map(parseIncoming).filter((m): m is ChatMsg => !!m));
    };

    // Tell the room my lag once per connection, unless my latest stamp already says it.
    const announceLag = () => {
      if (replay) return;
      const lag = store.effectiveLag();
      const mine = store.all().filter((m) => m.senderId === s.guestId && m.kind === "lag").at(-1);
      if (mine?.lag === lag) return;
      transport
        .sendCustom(SB_TYPES.lag, sbContent("lag", { lag, source: sourceRef.current.slice(0, 16), n: s.name, a: s.avatar }))
        .then((raw) => {
          const m = parseIncoming(raw);
          if (m && !disposed) store.add([m]);
        })
        .catch(() => undefined);
    };

    let wasDown = false;
    (async () => {
      try {
        // Clock first: a message shown with a wrong clock could unlock early, and reveals are permanent.
        await syncClock();
        if (disposed) return;
        offs.push(transport.onMessages(ingest));
        offs.push(
          transport.onStatus((st) => {
            if (disposed) return;
            setStatus(st);
            if (st === "reconnecting" || st === "offline") wasDown = true;
            if (st === "connected" && wasDown) {
              wasDown = false;
              syncClock().then(loadHistory).catch(() => undefined);
            }
          }),
        );
        await transport.connect();
        await loadHistory();
        announceLag();
        if (!disposed) {
          setStatus("connected");
          setReady(true);
        }
      } catch (e) {
        console.warn("room connect failed", e);
        if (!disposed) setStatus("failed");
      }
    })();

    const clockTimer = setInterval(() => syncClock().catch(() => undefined), CLOCK_REFRESH_MS);
    const onOnline = () => setStatus((st) => (st === "offline" ? "reconnecting" : st));
    const onOffline = () => {
      wasDown = true;
      setStatus("offline");
    };
    const onVisible = () => document.visibilityState === "visible" && setUnseen(0);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearInterval(clockTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      offs.forEach((f) => f());
      transport.close();
      store.dispose();
      storeRef.current = null;
      setReady(false);
    };
    // initialLagMs/source are read once per connection on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.code, s.guestId, s.token, s.demo, attempt, replay]);

  const sendText = useCallback(
    async (text: string) => {
      const store = storeRef.current;
      const tr = transportRef.current;
      if (!store || !tr) throw new Error("not connected");
      const raw = await tr.sendText(text, encodeTextExtra(store.effectiveLag(), s.name, s.avatar));
      const m = parseIncoming(raw);
      if (m) store.add([m]);
      track("message_sent", s.code);
    },
    [s.code, s.name, s.avatar],
  );

  const sendRoar = useCallback(
    async (intensity: 1 | 2 | 3, dur: number) => {
      const store = storeRef.current;
      const tr = transportRef.current;
      if (!store || !tr) return;
      const raw = await tr.sendCustom(SB_TYPES.roar, sbContent("roar", { lag: store.effectiveLag(), intensity, dur, n: s.name, a: s.avatar }));
      const m = parseIncoming(raw);
      if (m) {
        store.add([m]);
        emitRoarsRef.current([m]);
      }
      track("roar_sent", s.code, { intensity });
    },
    [s.code, s.name, s.avatar],
  );

  const startSyncCheck = useCallback(
    async (label: string) => {
      const store = storeRef.current;
      const tr = transportRef.current;
      if (!store || !tr) throw new Error("not connected");
      const checkId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const raw = await tr.sendCustom(
        SB_TYPES.synccheck,
        sbContent("synccheck", { lag: store.effectiveLag(), checkId, label: label.slice(0, 60), n: s.name, a: s.avatar }),
      );
      const m = parseIncoming(raw);
      if (m) store.add([m]);
    },
    [s.name, s.avatar],
  );

  /** Sends an SB:* message stamped with my lag and adds it to my store. */
  const sendSb = useCallback(
    async <K extends "call" | "callvote" | "callresult" | "anchor">(kind: K, p: Omit<SbPayload<K>, "v" | "lag" | "n" | "a">) => {
      const store = storeRef.current;
      const tr = transportRef.current;
      if (!store || !tr) throw new Error("not connected");
      const content = sbContent(kind, { ...p, lag: store.effectiveLag(), n: s.name, a: s.avatar } as Omit<SbPayload<K>, "v">);
      const m = parseIncoming(await tr.sendCustom(SB_TYPES[kind], content));
      if (m) store.add([m]);
    },
    [s.name, s.avatar],
  );
  const startCall = useCallback(
    async (q: string, opts: string[]) => {
      await sendSb("call", { callId: crypto.randomUUID().replace(/-/g, "").slice(0, 12), q: q.slice(0, 60), opts: opts.slice(0, 5).map((o) => o.slice(0, 16)) });
      track("call_started", s.code);
    },
    [sendSb, s.code],
  );
  /** Room creator: mark the match as over. It's an anchor, so each viewer's recap opens when the end reaches their screen. */
  const endMatch = useCallback((label: string) => sendSb("anchor", { label: label.slice(0, 40) }), [sendSb]);
  const pickCall = useCallback(
    async (callId: string, pick: number) => {
      await sendSb("callvote", { callId, pick });
      track("call_picked", s.code);
    },
    [sendSb, s.code],
  );
  const answerCall = useCallback((callId: string, answer: number) => sendSb("callresult", { callId, answer }), [sendSb]);

  const syncTap = useCallback(
    async (checkId: string) => {
      const store = storeRef.current;
      const tr = transportRef.current;
      if (!store || !tr) throw new Error("not connected");
      const raw = await tr.sendCustom(SB_TYPES.synctap, sbContent("synctap", { lag: store.effectiveLag(), checkId, n: s.name, a: s.avatar }));
      const m = parseIncoming(raw);
      if (m) store.add([m]);
    },
    [s.name, s.avatar],
  );

  const setLag = useCallback(
    (ms: number, source: string) => {
      const store = storeRef.current;
      if (!store) return;
      store.setLag(ms);
      if (replay) return; // a replay lag is hours long and private to this viewer
      sourceRef.current = source;
      const lag = store.effectiveLag();
      if (!s.ephemeral) saveRoomPrefs(s.code, { lagMs: lag, source });
      // Debounced so dragging the slider doesn't flood the room (client limit is 5 msg/s).
      if (lagTimer.current) clearTimeout(lagTimer.current);
      lagTimer.current = setTimeout(() => {
        const st = storeRef.current;
        const tr = transportRef.current;
        if (!st || !tr) return;
        const content = sbContent("lag", { lag: st.effectiveLag(), source: sourceRef.current.slice(0, 16), n: s.name, a: s.avatar });
        tr.sendCustom(SB_TYPES.lag, content)
          .then((raw) => {
            const m = parseIncoming(raw);
            if (m) st.add([m]);
          })
          .catch(() => undefined);
        track("lag_set", s.code, { source: sourceRef.current, lagS: Math.round(st.effectiveLag() / 1000) });
      }, 800);
    },
    [s.code, s.name, s.avatar, s.ephemeral, replay],
  );

  return {
    heldBack,
    ready,
    status,
    retry: () => setAttempt((a) => a + 1),
    isDemo: s.demo || !s.token,
    ...snap,
    unseen,
    announce,
    clockOffset,
    sendText,
    sendRoar,
    startSyncCheck,
    syncTap,
    startCall,
    endMatch,
    pickCall,
    answerCall,
    setLag,
    spoil: (id: string) => storeRef.current?.spoil(id),
    spoilAll: () => storeRef.current?.spoilAll(),
    pause: () => storeRef.current?.pause(),
    resume: () => storeRef.current?.resume(),
    /** Live rooms, after "I paused": resume, then save and announce the new delay (`ms` null = keep the pause added). */
    resumeAt: (ms: number | null, source: string) => {
      const st = storeRef.current;
      if (!st) return;
      st.resume();
      setLag(ms ?? st.effectiveLag(), source);
    },
    /** Replay only: move my lag by `ms` (positive = the chat goes back in the match). */
    nudge: (ms: number) => {
      const st = storeRef.current;
      if (st) st.setLag(st.effectiveLag() + ms);
    },
    /** The match moment my screen shows right now (server time minus my lag). */
    matchNow: () => nowRef.current() - (storeRef.current?.effectiveLag() ?? 0),
  };
}
