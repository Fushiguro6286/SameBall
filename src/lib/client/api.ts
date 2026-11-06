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

export interface Auth {
  guestId: string;
  key: string;
}

export async function startSession(req: SessionReq) {
  const send = (r: SessionReq) => post("/api/session", { ...r, test: r.test || isTestBrowser() || undefined });
  try {
    return SessionRes.parse(await send(req));
  } catch (e) {
    // This browser lost the key for its guest: start over as a new guest rather than lock the person out.
    if (e instanceof ApiError && e.code === "bad_key" && req.guestId) return SessionRes.parse(await send({ ...req, guestId: undefined, key: undefined }));
    throw e;
  }
}

export const createRoomApi = (req: Auth & { roomName: string; sport: string; startsAt?: string }) =>
  post<{ code: string; channelId: string; name: string; sport: string }>("/api/rooms", req);

export const startTryApi = (req: { guestId?: string; key?: string; name?: string; avatar?: string }) =>
  post<{ guestId: string; key: string; name: string; avatar: string; code: string }>("/api/try", { ...req, test: isTestBrowser() || undefined });
export const tryStartApi = (a: Auth, code: string) => post<{ ok: true }>("/api/try/start", { ...a, code });
export const tryStepApi = (a: Auth, code: string, step: number) => post<{ ok: true }>("/api/try/step", { ...a, code, step });

export const presenceApi = (a: Auth, code: string) => post<{ watching: number }>("/api/presence", { ...a, code });
export const moderateApi = (a: Auth, code: string, targetId: string, action: "mute" | "remove") =>
  post<{ ok: true }>("/api/moderate", { ...a, code, targetId, action });
export const reportApi = (a: Auth, code: string, targetId: string, reason?: string) => post<{ ok: true }>("/api/report", { ...a, code, targetId, reason });

export const catchupApi = (a: Auth, code: string, lag: number, msgs: { name: string; text: string; matchTime: number }[]) =>
  post<{ bullets: string[] }>("/api/catchup", { ...a, code, lag, msgs });

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t.errors.rate;
    if (e.code === "name_not_allowed") return t.errors.name;
    if (e.code === "chat_unavailable") return t.errors.chat;
    if (e.code === "room_not_found") return t.room.notFound;
    if (e.code === "removed") return t.mod.removedYou;
  }
  return t.errors.generic;
}

export async function fetchServerTime(): Promise<number> {
  const res = await fetch("/api/time", { cache: "no-store" });
  if (!res.ok) throw new Error("time");
  return ((await res.json()) as { ts: number }).ts;
}
