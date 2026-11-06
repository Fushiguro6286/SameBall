// Per-browser conveniences in localStorage. Every access is guarded: storage can be blocked.

import { STADIUM_STANDS, asStand, type StandId } from "../config";
import type { Lang } from "../i18n";

export interface Profile {
  guestId?: string;
  /** Server-issued key that proves this browser owns guestId. */
  key?: string;
  name: string;
  avatar: string;
}
export interface SavedRoom {
  code: string;
  name: string;
}
export interface RoomPrefs {
  lagMs: number;
  source: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const loadProfile = () => read<Profile | null>("sb-profile", null);
export const saveProfile = (p: Profile) => write("sb-profile", p);

export const loadRooms = () => read<SavedRoom[]>("sb-rooms", []);
export function rememberRoom(r: SavedRoom) {
  write("sb-rooms", [r, ...loadRooms().filter((x) => x.code !== r.code)].slice(0, 20));
}

export const loadRoomPrefs = (code: string) => read<RoomPrefs | null>(`sb-room:${code}`, null);
export const saveRoomPrefs = (code: string, p: RoomPrefs) => write(`sb-room:${code}`, p);

/** Which stadium stand this browser sits in; defaults to one picked from the guest id so crowds spread out. */
export function loadStand(code: string, guestId: string): StandId {
  const saved = asStand(read<string | null>(`sb-stand:${code}`, null));
  if (saved) return saved;
  let h = 0;
  for (const c of guestId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return STADIUM_STANDS[h % STADIUM_STANDS.length];
}
export const saveStand = (code: string, stand: StandId) => write(`sb-stand:${code}`, stand);

/** UI language: saved choice, else Hindi for browsers set to Hindi. */
export function loadLang(): Lang {
  const saved = read<string | null>("sb-lang", null);
  if (saved === "hi" || saved === "en") return saved;
  try {
    return navigator.language.toLowerCase().startsWith("hi") ? "hi" : "en";
  } catch {
    return "en";
  }
}
export const saveLang = (l: Lang) => write("sb-lang", l);

/** Per-browser on/off settings: "suspense" (Hype Radar), "muted" (stadium sound). */
/** Small per-room choices: the chip pack, the couch-mode friend. */
export const loadRoomStr = (kind: "chips" | "couch", code: string) => read<string | null>(`sb-${kind}:${code}`, null);
export const saveRoomStr = (kind: "chips" | "couch", code: string, v: string | null) => write(`sb-${kind}:${code}`, v);

export const loadSetting = (key: string, fallback: boolean) => read<boolean>(`sb-set:${key}`, fallback);
export const saveSetting = (key: string, on: boolean) => write(`sb-set:${key}`, on);

/** Senders this browser has blocked (hidden everywhere, all rooms). */
export const loadBlocked = () => read<string[]>("sb-blocked", []);
export const saveBlocked = (ids: string[]) => write("sb-blocked", ids.slice(-500));

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
