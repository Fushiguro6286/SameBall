import { t } from "../i18n";
import { SessionRes, type SessionReq } from "../api-schemas";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "error");
  return data as T;
}

export const startSession = async (req: SessionReq) => SessionRes.parse(await post("/api/session", req));

export const createRoomApi = (req: { guestId: string; roomName: string; sport: string }) =>
  post<{ code: string; channelId: string; name: string; sport: string }>("/api/rooms", req);

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t.errors.rate;
    if (e.code === "name_not_allowed") return t.errors.name;
    if (e.code === "chat_unavailable") return t.errors.chat;
    if (e.code === "room_not_found") return t.room.notFound;
  }
  return t.errors.generic;
}

export async function fetchServerTime(): Promise<number> {
  const res = await fetch("/api/time", { cache: "no-store" });
  if (!res.ok) throw new Error("time");
  return ((await res.json()) as { ts: number }).ts;
}
