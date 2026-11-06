// DEMO transport for local development only: tabs on one machine talk over BroadcastChannel.
// The UI shows a DEMO MODE banner whenever this is used.

import type { ConnState, Transport } from "./types";
import { RawMsg, TEXT_TYPE, VOICE_TYPE } from "./wire";

const HISTORY_CAP = 500;

export function createLocalTransport(opts: { roomCode: string; userId: string }): Transport {
  const bc = new BroadcastChannel(`sameball-demo:${opts.roomCode}`);
  const key = `sb-demo-history:${opts.roomCode}`;
  const subs = new Set<(m: RawMsg[]) => void>();

  const readHistory = (): RawMsg[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  };
  const append = (m: RawMsg) => {
    try {
      localStorage.setItem(key, JSON.stringify([...readHistory(), m].slice(-HISTORY_CAP)));
    } catch {
      // storage full or blocked; live delivery still works
    }
  };

  bc.onmessage = (e: MessageEvent<RawMsg>) => subs.forEach((f) => f([e.data]));

  const send = async (type: string, content: Record<string, unknown>) => {
    const m: RawMsg = { id: crypto.randomUUID(), type, senderId: opts.userId, sentTime: Date.now(), content };
    append(m);
    bc.postMessage(m);
    return m;
  };

  return {
    kind: "local",
    connect: async () => opts.userId,
    sendText: (text, extra) => send(TEXT_TYPE, { text, extra }),
    sendCustom: (type, content) => send(type, content),
    // Demo only: the audio travels inline as a data URL.
    sendVoice: async (file, duration, extra) => {
      const remoteUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      return send(VOICE_TYPE, { remoteUrl, duration, extra });
    },
    loadHistory: async () => readHistory(),
    onMessages(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    onDeleted: () => () => {}, // demo rooms have no server recall
    onStatus(cb: (s: ConnState) => void) {
      cb("connected");
      return () => {};
    },
    close() {
      subs.clear();
      bc.close();
    },
  };
}
