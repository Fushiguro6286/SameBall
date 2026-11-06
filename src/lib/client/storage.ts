// Per-browser conveniences in localStorage. Every access is guarded: storage can be blocked.

export interface Profile {
  guestId?: string;
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

/** Per-browser on/off settings: "suspense" (Hype Radar), "muted" (stadium sound). */
export const loadSetting = (key: string, fallback: boolean) => read<boolean>(`sb-set:${key}`, fallback);
export const saveSetting = (key: string, on: boolean) => write(`sb-set:${key}`, on);

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
