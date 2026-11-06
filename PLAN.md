# SameBall: Phase 0 plan

Checked against `@nexconn/chat` and `@nexconn/engine` **26.2.1** (`index.d.ts`) and docs.nexconn.ai (pages updated Nov 5, 2026). Where the docs and the types disagree, the types win.

## Client SDK (verified in types)

| Need | Verified API |
|---|---|
| Init (once) | `NCEngine.initialize({ appKey, areaCode?, logLevel? })`. `AreaCode` = `{ BJ:1, SG:2 (default), NA:3, SA:5, OM:6 }` |
| Custom types | `NCEngine.registerCustomMessages([{ messageType, isPersisted, isCounted, isStatusMessage? }])`. Must run **before** `connect` |
| Listeners | `NCEngine.addConnectionStatusHandler(id, new ConnectionStatusHandler({ onConnectionStatusChanged({status, code}) }))`, `NCEngine.addMessageHandler(id, new MessageHandler({ onMessageReceived({ messages }) }))` |
| Connect | `NCEngine.connect({ token })` returns `Promise<NCResult<{userId}>>` (`isOk`, `code`, `data`). Reconnection is built in |
| Status | `ConnectionStatus`: `CONNECTED 0, CONNECTING 1, DISCONNECTED 2, SUSPENDED 3` (SUSPENDED retries after 5 s) |
| Channel | `new GroupChannel(channelId)`, then `.sendMessage(params)` and `.identifier` |
| Text + lag | `new SendTextMessageParams({ text, extra })`. `TextMessageContent` has `extra?: string` |
| Custom send | `new SendMessageParams<T>(content, 'SB:Roar')` |
| **Server sent time** | `Message.sentTime: number`, "Timestamp (ms) when the message was sent" (server-assigned). Also `messageId`, `senderUserId`, `messageType`, `content`, `metadata: Map` |
| History | `BaseChannel.createMessagesQuery({ channelIdentifier, startTime?, pageSize?, isAscending? })`, then `query.loadNextPage()` returns `NCResult<{ data: Message[] }>`. `query.hasNext` exists. The web SDK has no local cache: every page comes from the server |
| Disconnect | `NCEngine.disconnect()` |

**Where the lag stamp goes:** we use `content.extra = '{"sb":1,"lag":25000}'`, not `metadata`. `extra` is part of the immutable message body, and the server API can set it in the same way (`content: "{\"content\":\"hi\",\"extra\":\"...\"}"`). Message metadata can be changed after sending with `setMetadata`, and that uses up send rate quota.

## Server API (signing verified live on Nov 6: app is in **Singapore**, SG domain returned `code 0`, US and SAU returned 403 "App-Key is not exist")

Note: the docs say `result.status` is a number, but the live API returned the string `"0"`. Parse API fields leniently.

- **Signing:** headers `App-Key`, `Nonce` (≤ 18 chars), `Timestamp` (**ms**), `Signature = sha1(AppSecret + Nonce + Timestamp)` in lowercase hex. A bad signature returns 401. Every endpoint is POST with a JSON body.
- **Domains:** SG `api.sg-light-api.com` / backup `api-b.sg-light-api.com`; NA `api.us-light-api.com` / `api-b.us-light-api.com`. Switch to the backup on a 5 s timeout or an unexpected status.
- **Token:** `POST /v4/auth/access-token/issue` with `{ userId, name, avatarUrl? }` returns `result.accessToken`. Calling it again for the same user is fine. 200 req/s.
- **Groups:** `/v4/group-channel/create` `{ channelId, name, owner, userIds? (≤ 30), permissions? }` · `/v4/group-channel/join` · `/v4/group-channel/leave` · `/v4/group-channel/member/list` · mute `/v4/group-channel/user/mute-list/add` `{ userIds, channelId, durationMinutes }`.
- **Send as a user (bots):** `POST /v4/group-channel/message/send` `{ fromUserId, toChannelIds, messageType, content (string ≤ 10 KB), shouldPersist?, metadata? }`. Custom types work if they are registered on the client, are ≤ 32 chars and don't start with `RC:`. **Judge Mode bots are feasible.** 20 msg/s.
- **Webhooks:** envelope `{ type, id, time, data[] }`. Headers `AppKey` (no hyphen), `Nonce`, `Timestamp`, `Signature`, with the same sha1 formula. Event `message:send`. Messages sent by the server API are left out unless the Console option "Include Server API Messaging in post-event webhooks" is on, which suits us because bots stay out of the counts.
- **Presence:** `/v4/user/connection-status/get` checks one user at a time and is rate-limited. On the client, `userModule.subscribeEvent({ userIds, subscribeType: ONLINE_STATUS })` has a capped subscription count. There is no channel-level presence.
- **Rate limits:** 100 req/s per App Key by default; 429 when exceeded. Client SDK: **5 messages/s across all channels**.

## Things in the brief that were wrong or need changing

1. The message "extra" field is `content.extra` (a string). Separately, there is `metadata: Record<string,string>`. We use `extra`.
2. The docs spell the custom-type flag `isPersited`; the types say `isPersisted`. We follow the types.
3. "Transient" messages are custom types registered with `isStatusMessage: true`. There is no separate API.
4. The server API content limit is **10 KB** (the brief said 15 KB). Our payloads are under 1 KB, so this doesn't matter.
5. "Watching now" can't use Nexconn presence for a whole room, so it will use our own heartbeat (`/api/presence`, kept in memory or the DB).
6. Muting through the server API doesn't stop messages sent through the server API. That doesn't matter, since only bots send that way.
7. The webhook header is `AppKey`, but request headers use `App-Key`.

## Open questions for you

1. ~~Data center~~: answered, Singapore (`NEXCONN_AREA=SG`).
2. Please turn on these Console settings: **pre-join history for new members**, **profanity filter**, the **Webhooks** URL (once deployed), and if offered, **"Subscribe to user online status"** (optional).
3. **Vercel:** you're logged in through `npx vercel`, but the account has more than one team and the production deploy needs your approval. Which team should the `sameball` project go in? Or approve: `! npx vercel deploy --prod --yes --project sameball --scope <team-slug>`.
4. **GitHub:** which repo name and account should I push the public repo to?
5. **Neon:** should I provision Neon through the Vercel Marketplace, or will you paste a `DATABASE_URL`?
