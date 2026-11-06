// Nexconn Web Chat SDK transport. Browser only: the SDK is loaded with a dynamic import.
// One engine per page lifetime (initialize + connect exactly once); rooms just filter by channel.

import type { ConnState, Transport } from "./types";
import { RawMsg, SB_TYPES, SbType } from "./wire";

type Sdk = typeof import("@nexconn/chat");
type NcMessage = InstanceType<Sdk["Message"]>;

let sdkP: Promise<Sdk> | null = null;
let connectedAs: string | null = null;
let connecting: Promise<string> | null = null;
let everConnected = false;
let status: ConnState = "connecting";
const msgSubs = new Set<(m: NcMessage[]) => void>();
const statusSubs = new Set<(s: ConnState) => void>();

function setStatus(s: ConnState) {
  status = s;
  statusSubs.forEach((f) => f(s));
}

function loadSdk(appKey: string, area: string): Promise<Sdk> {
  sdkP ??= import("@nexconn/chat").then((sdk) => {
    const areaCode = (sdk.AreaCode as Record<string, number>)[area] ?? sdk.AreaCode.SG;
    sdk.NCEngine.initialize({ appKey, areaCode: areaCode as never, logLevel: sdk.LogLevel.WARN });
    // Must be registered before connect.
    sdk.NCEngine.registerCustomMessages(
      Object.values(SB_TYPES).map((messageType) => ({ messageType, isPersisted: true, isCounted: false })),
    );
    sdk.NCEngine.addConnectionStatusHandler(
      "sb-status",
      new sdk.ConnectionStatusHandler({
        onConnectionStatusChanged({ status: s }) {
          const S = sdk.ConnectionStatus;
          if (s === S.CONNECTED) {
            everConnected = true;
            setStatus("connected");
          } else if (s === S.CONNECTING) setStatus(everConnected ? "reconnecting" : "connecting");
          else setStatus(everConnected ? "reconnecting" : "offline");
        },
      }),
    );
    sdk.NCEngine.addMessageHandler(
      "sb-messages",
      new sdk.MessageHandler({
        onMessageReceived({ messages }) {
          msgSubs.forEach((f) => f(messages));
        },
      }),
    );
    return sdk;
  });
  return sdkP;
}

const toRaw = (m: NcMessage): RawMsg => ({
  id: m.messageId,
  type: m.messageType,
  senderId: m.senderUserId,
  sentTime: m.sentTime,
  content: parseContent(m.content),
});

/** Server-API custom messages could arrive as a JSON string; never drop them for that. */
function parseContent(c: unknown): Record<string, unknown> {
  if (typeof c !== "string") return (c ?? {}) as Record<string, unknown>;
  try {
    const v = JSON.parse(c);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

const subOf = (m: NcMessage) => (m.channelIdentifier as { subChannelId?: string } | undefined)?.subChannelId || undefined;

// Client-wide limit is 5 messages/s across all channels; space sends 250 ms apart.
let sendChain: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = sendChain.then(fn, fn);
  sendChain = run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, 250)));
  return run;
}

/** With `subChannelId` the room is a stadium stand: a sub-channel of a community channel. */
export function createNexconnTransport(opts: { appKey: string; area: string; token: string; userId: string; channelId: string; subChannelId?: string }): Transport {
  const cleanups: (() => void)[] = [];
  let channel: InstanceType<Sdk["GroupChannel"]> | InstanceType<Sdk["CommunitySubChannel"]> | null = null;

  const ready = async () => {
    const sdk = await loadSdk(opts.appKey, opts.area);
    channel ??= opts.subChannelId ? new sdk.CommunitySubChannel(opts.channelId, opts.subChannelId) : new sdk.GroupChannel(opts.channelId);
    return { sdk, channel };
  };

  return {
    kind: "nexconn",

    async connect() {
      const { sdk } = await ready();
      if (connectedAs === opts.userId) return opts.userId;
      if (connectedAs && connectedAs !== opts.userId) {
        await sdk.NCEngine.disconnect();
        connectedAs = null;
      }
      connecting ??= sdk.NCEngine.connect({ token: opts.token }).then((res) => {
        connecting = null;
        if (!res.isOk) throw new Error(`connect failed (${res.code})`);
        connectedAs = res.data?.userId ?? opts.userId;
        everConnected = true;
        setStatus("connected");
        return connectedAs;
      });
      return connecting;
    },

    async sendText(text, extra) {
      const { sdk, channel } = await ready();
      const res = await queued(() => channel.sendMessage(new sdk.SendTextMessageParams({ text, extra })));
      if (!res.isOk || !res.data) throw new Error(`send failed (${res.code})`);
      return toRaw(res.data);
    },

    async sendCustom(type: SbType, content) {
      const { sdk, channel } = await ready();
      const res = await queued(() => channel.sendMessage(new sdk.SendMessageParams(content, type)));
      if (!res.isOk || !res.data) throw new Error(`send failed (${res.code})`);
      return toRaw(res.data);
    },

    async loadHistory(pages) {
      const { sdk, channel } = await ready();
      const q = sdk.BaseChannel.createMessagesQuery({ channelIdentifier: channel.identifier, pageSize: 100, isAscending: false });
      const out: RawMsg[] = [];
      for (let i = 0; i < pages; i++) {
        const res = await q.loadNextPage();
        if (!res.isOk || !res.data) throw new Error(`history failed (${res.code})`);
        out.push(...res.data.data.map(toRaw));
        if (!q.hasNext || res.data.data.length === 0) break;
      }
      return out;
    },

    onMessages(cb) {
      const f = (msgs: NcMessage[]) => {
        // Community members receive every public sub-channel, so a stand keeps only its own.
        const mine = msgs.filter((m) => m.channelIdentifier?.channelId === opts.channelId && subOf(m) === opts.subChannelId).map(toRaw);
        if (mine.length) cb(mine);
      };
      msgSubs.add(f);
      const off = () => msgSubs.delete(f);
      cleanups.push(off);
      return off;
    },

    onStatus(cb) {
      statusSubs.add(cb);
      cb(status);
      const off = () => statusSubs.delete(cb);
      cleanups.push(off);
      return off;
    },

    close() {
      cleanups.splice(0).forEach((f) => f());
    },
  };
}
