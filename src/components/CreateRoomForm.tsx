"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRoomApi, errorText, isTestBrowser, startSession } from "@/lib/client/api";
import { setMetricsUser, track } from "@/lib/client/metrics";
import { loadProfile, rememberRoom, saveProfile } from "@/lib/client/storage";
import { AVATARS, ROOM_NAME_MAX, SPORTS, type Sport } from "@/lib/config";
import { t } from "@/lib/i18n";
import { ProfileFields } from "./ProfileFields";

export function CreateRoomForm() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [sport, setSport] = useState<Sport>("cricket");
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isTestBrowser(); // remembers ?test=1 from the landing URL
    const p = loadProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only storage
    if (p?.name) setName(p.name);
    if (p?.avatar) setAvatar(p.avatar);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const prev = loadProfile();
      const s = await startSession({ guestId: prev?.guestId, name: name.trim(), avatar: avatar as (typeof AVATARS)[number] });
      saveProfile({ guestId: s.guestId, name: name.trim(), avatar });
      setMetricsUser(s.guestId);
      const room = await createRoomApi({
        guestId: s.guestId,
        roomName: roomName.trim(),
        sport,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      });
      rememberRoom({ code: room.code, name: room.name });
      track("room_created", room.code, { sport });
      router.push(`/r/${room.code}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form
      id="create"
      className="w-full space-y-5 rounded-3xl border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (roomName.trim() && name.trim()) submit();
      }}
    >
      <h2 className="font-display text-4xl leading-none">{t.create.title}</h2>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t.create.roomNameLabel}</span>
        <input
          required
          maxLength={ROOM_NAME_MAX}
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder={t.create.roomNamePlaceholder}
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-base placeholder:text-muted/70"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">{t.create.sportLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <label key={s}>
              <input type="radio" name="sport" value={s} checked={sport === s} onChange={() => setSport(s)} className="peer sr-only" />
              <span className="inline-block cursor-pointer rounded-full border border-line bg-surface-2 px-3.5 py-2 text-sm peer-checked:border-accent peer-checked:bg-accent/15 peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {t.sports[s]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t.schedule.field}</span>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-base [color-scheme:dark]"
        />
      </label>
      <ProfileFields name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      {error && (
        <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <button disabled={busy} className="w-full rounded-full bg-accent py-3 font-semibold text-accent-ink disabled:opacity-60">
        {busy ? t.create.creating : t.create.submit}
      </button>
    </form>
  );
}
