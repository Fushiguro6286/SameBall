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

/** Visiting any page with ?test=1 marks this browser as a tester, so its usage is left out of /stats. */
export function isTestBrowser(): boolean {
  try {
    if (new URLSearchParams(location.search).get("test") === "1") localStorage.setItem("sb-test", "1");
    return localStorage.getItem("sb-test") === "1";
  } catch {
    return false;
  }
}

export const startSession = async (req: SessionReq) =>
  SessionRes.parse(await post("/api/session", { ...req, test: req.test || isTestBrowser() || undefined }));

export const createRoomApi = (req: { guestId: string; roomName: string; sport: string; startsAt?: string }) =>
  post<{ code: string; channelId: string; name: string; sport: string }>("/api/rooms", req);

export const startTryApi = (req: { guestId?: string; name?: string; avatar?: string }) =>
  post<{ guestId: string; name: string; avatar: string; code: string }>("/api/try", { ...req, test: isTestBrowser() || undefined });
export const tryStartApi = (guestId: string, code: string) => post<{ ok: true }>("/api/try/start", { guestId, code });
export const tryStepApi = (guestId: string, code: string, step: number) => post<{ ok: true }>("/api/try/step", { guestId, code, step });

export const presenceApi = (guestId: string, code: string) => post<{ watching: number }>("/api/presence", { guestId, code });

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
