"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HISTORY_PAGES } from "../config";
import { fetchServerTime } from "../client/api";
import { track } from "../client/metrics";
import { saveRoomPrefs } from "../client/storage";
import { measureOffset } from "../timing/clock";
import type { ChatMsg } from "../timing/engine";
import { RoomStore, type ViewItem } from "../timing/room-store";
import { createLocalTransport } from "../transport/local";
import { createNexconnTransport } from "../transport/nexconn";
import type { ConnState, Transport } from "../transport/types";
import { RawMsg, SB_TYPES, encodeTextExtra, parseIncoming, sbContent } from "../transport/wire";

export interface RoomSession {
  code: string;
  channelId: string;
  guestId: string;
  name: string;
  avatar: string;
  demo: boolean;
  token?: string;
  appKey?: string;
  area?: string;
}

export type RoomStatus = ConnState | "failed";

const CLOCK_REFRESH_MS = 5 * 60_000;

interface Snapshot {
  view: ViewItem[];
  lockedCount: number;
  lagMs: number;
}
const snapshot = (st: RoomStore): Snapshot => ({ view: st.view(), lockedCount: st.lockedCount(), lagMs: st.effectiveLag() });

export function useRoom(s: RoomSession, initialLagMs: number, initialSource: string) {
  const storeRef = useRef<RoomStore | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const sourceRef = useRef(initialSource);
  const lagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snap, setSnap] = useState<Snapshot>({ view: [], lockedCount: 0, lagMs: initialLagMs });
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    let disposed = false;
    let offset = 0;
    const now = () => Date.now() + offset;
    const offs: (() => void)[] = [];

    const noteVisible = (msgs: ChatMsg[]) => {
      const others = msgs.filter((m) => m.kind === "text" && m.senderId !== s.guestId);
      if (!others.length) return;
      const last = others[others.length - 1];
      setAnnounce(`${last.senderName}: ${last.text ?? ""}`);
      if (document.visibilityState === "hidden") setUnseen((n) => n + others.length);
    };

    const store = new RoomStore(s.guestId, initialLagMs, now, {
      onLocked: (m) => m.kind === "text" && track("message_locked", s.code),
      onRevealed: (msgs, how) => {
        for (const m of msgs) if (m.kind === "text") track(how === "spoil" ? "spoil_me" : "revealed_on_time", s.code);
        noteVisible(msgs);
      },
      onChange: () => !disposed && setSnap(snapshot(store)),
    });
    storeRef.current = store;

    const ingest = (raws: RawMsg[]) => {
      const parsed = raws.map(parseIncoming).filter((m): m is ChatMsg => !!m);
      const fresh = parsed.filter((m) => !store.get(m.id));
      store.add(parsed);
      noteVisible(fresh.filter((m) => store.isRevealed(m.id)));
    };

    const transport =
      s.demo || !s.token
        ? createLocalTransport({ roomCode: s.code, userId: s.guestId })
        : createNexconnTransport({ appKey: s.appKey!, area: s.area ?? "SG", token: s.token, userId: s.guestId, channelId: s.channelId });
    transportRef.current = transport;

    const syncClock = async () => {
      offset = await measureOffset(fetchServerTime);
      if (!disposed) store.clockChanged();
    };

    const loadHistory = async () => {
      const raws = await transport.loadHistory(HISTORY_PAGES);
      if (!disposed) store.add(raws.map(parseIncoming).filter((m): m is ChatMsg => !!m));
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
  }, [s.code, s.guestId, s.token, s.demo, attempt]);

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

  const setLag = useCallback(
    (ms: number, source: string) => {
      const store = storeRef.current;
      if (!store) return;
      store.setLag(ms);
      sourceRef.current = source;
      const lag = store.effectiveLag();
      saveRoomPrefs(s.code, { lagMs: lag, source });
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
    [s.code, s.name, s.avatar],
  );

  return {
    ready,
    status,
    retry: () => setAttempt((a) => a + 1),
    isDemo: s.demo || !s.token,
    ...snap,
    unseen,
    announce,
    sendText,
    setLag,
    spoil: (id: string) => storeRef.current?.spoil(id),
    spoilAll: () => storeRef.current?.spoilAll(),
  };
}
