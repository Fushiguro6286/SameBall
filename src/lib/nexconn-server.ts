import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Signed Nexconn Chat Server API client. Secret never leaves the server.
// Signature = sha1(AppSecret + Nonce + Timestamp(ms)), lowercase hex. All endpoints are POST JSON.

export class NexconnError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(`Nexconn ${code}: ${message}`);
  }
}

export const NC = {
  ALREADY_MEMBER: 25412,
  GROUP_FULL: 25411,
  GROUP_EXISTS: 25409,
} as const;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const sign = (secret: string, nonce: string, timestamp: string) =>
  createHash("sha1").update(secret + nonce + timestamp).digest("hex");

/** Verify webhook signature headers (`AppKey`, `Nonce`, `Timestamp`, `Signature`). */
export function verifySignature(nonce: string | null, timestamp: string | null, signature: string | null): boolean {
  if (!nonce || !timestamp || !signature) return false;
  const expected = Buffer.from(sign(env("NEXCONN_APP_SECRET"), nonce, timestamp));
  const got = Buffer.from(signature.toLowerCase());
  return expected.length === got.length && timingSafeEqual(expected, got);
}

async function post(base: string, path: string, body: unknown): Promise<Response> {
  const nonce = randomBytes(8).toString("hex");
  const timestamp = String(Date.now());
  return fetch(base + path, {
    method: "POST",
    headers: {
      "App-Key": env("NEXCONN_APP_KEY"),
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: sign(env("NEXCONN_APP_SECRET"), nonce, timestamp),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
}

/** Calls an endpoint; fails over to the backup domain on timeout, network error or 5xx. */
export async function ncCall<T = unknown>(path: string, body: unknown, okCodes: number[] = []): Promise<{ code: number; result?: T }> {
  const bases = [env("NEXCONN_API_BASE"), process.env.NEXCONN_API_BASE_BACKUP].filter(Boolean) as string[];
  let lastErr: unknown;
  for (const base of bases) {
    let res: Response;
    try {
      res = await post(base, path, body);
    } catch (e) {
      lastErr = e;
      continue;
    }
    if (res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as { code?: number; result?: T; errorMessage?: string; msg?: string };
    const code = Number(json.code ?? res.status);
    if (code === 0 || okCodes.includes(code)) return { code, result: json.result };
    throw new NexconnError(code, json.errorMessage ?? json.msg ?? `HTTP ${res.status}`);
  }
  throw lastErr instanceof Error ? lastErr : new Error("Nexconn unreachable");
}

export async function issueToken(userId: string, name: string): Promise<string> {
  const { result } = await ncCall<{ accessToken: string }>("/v4/auth/access-token/issue", { userId, name });
  if (!result?.accessToken) throw new NexconnError(-1, "no accessToken in response");
  return result.accessToken;
}

export async function createGroup(channelId: string, name: string, owner: string, extraMembers: string[] = []) {
  await ncCall("/v4/group-channel/create", {
    channelId,
    name: name.slice(0, 64),
    owner,
    userIds: [owner, ...extraMembers],
    permissions: { joinPerm: 1 }, // anyone with the link can join
  });
}

/** Returns "joined", "already" or "full". */
export async function joinGroup(channelId: string, userId: string): Promise<"joined" | "already" | "full"> {
  const { code } = await ncCall("/v4/group-channel/join", { channelId, userIds: [userId] }, [NC.ALREADY_MEMBER, NC.GROUP_FULL]);
  return code === NC.ALREADY_MEMBER ? "already" : code === NC.GROUP_FULL ? "full" : "joined";
}

export async function leaveGroup(channelId: string, userId: string) {
  await ncCall("/v4/group-channel/leave", { channelId, userIds: [userId] }, [25418]);
}

/** Mutes a member in one group channel for a while. */
export async function muteInGroup(channelId: string, userId: string, durationMinutes: number) {
  await ncCall("/v4/group-channel/user/mute-list/add", { channelId, userIds: [userId], durationMinutes });
}

/** Send as a given user (Judge Mode bots). `content` is the message-type's JSON. */
/** Deletes (recalls) a message for everyone. Docs: platform-chat-api/message/msgrecall. */
export async function recallMessage(fromUserId: string, channelId: string, messageId: string, sentAt?: number) {
  await ncCall("/v4/message/delete", { fromUserId, channelType: 3, channelId, messageId, ...(sentAt ? { sentAt } : {}) });
}

/**
 * "Quiet fans": freeze the group so only allowed senders (the host) can post from the SDK.
 * Docs: platform-chat-api/group-channel/mute/ban-group, unban-group, add-to-group-ban-whitelist.
 */
export async function setGroupQuiet(channelId: string, hostId: string, on: boolean) {
  if (on) {
    await ncCall("/v4/group-channel/allowed-sender-list/add", { channelId, userIds: [hostId] });
    await ncCall("/v4/group-channel/freeze-list/add", { channelIds: [channelId] });
  } else {
    await ncCall("/v4/group-channel/freeze-list/remove", { channelIds: [channelId] });
  }
}

export async function sendGroupMessage(fromUserId: string, channelId: string, messageType: string, content: object) {
  await ncCall("/v4/group-channel/message/send", {
    fromUserId,
    toChannelIds: [channelId],
    messageType,
    content: JSON.stringify(content),
  });
}

// Community channels (stadiums): up to 10,000 members; each public sub-channel is a "stand".
// Every member receives every public sub-channel, so clients filter by sub-channel id.

export async function createCommunity(channelId: string, name: string, owner: string, stands: readonly string[]) {
  await ncCall("/v4/community-channel/create", { userId: owner, channelId, name: name.slice(0, 64) });
  for (const subchannelId of stands) await ncCall("/v4/community-channel/subchannel/create", { channelId, subchannelId, channelVisibility: 0 });
}

/** Idempotent: joining again returns success. */
export async function joinCommunity(channelId: string, userId: string) {
  await ncCall("/v4/community-channel/join", { userId, channelId });
}

export async function sendCommunityMessage(fromUserId: string, channelId: string, subchannelId: string, messageType: string, content: object) {
  await ncCall("/v4/community-channel/message/send", { fromUserId, toChannelIds: [channelId], subchannelId, messageType, content: JSON.stringify(content) });
}

/** Client-side config the browser needs (no secrets). */
export function clientConfig() {
  return { appKey: env("NEXCONN_APP_KEY"), area: process.env.NEXCONN_AREA ?? "SG" };
}
