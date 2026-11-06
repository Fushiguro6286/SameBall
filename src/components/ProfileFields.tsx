"use client";

import { AVATARS, NAME_MAX } from "@/lib/config";
import { useT } from "@/lib/i18n/client";

export function ProfileFields({
  name,
  avatar,
  onName,
  onAvatar,
}: {
  name: string;
  avatar: string;
  onName: (v: string) => void;
  onAvatar: (v: string) => void;
}) {
  const t = useT();
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t.profile.nameLabel}</span>
        <input
          required
          maxLength={NAME_MAX}
          autoComplete="nickname"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={t.profile.namePlaceholder}
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-base placeholder:text-muted"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">{t.profile.avatarLabel}</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATARS.map((a) => (
            <label key={a} className="relative">
              <input type="radio" name="avatar" value={a} checked={avatar === a} onChange={() => onAvatar(a)} className="peer sr-only" />
              <span className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2 text-xl peer-checked:border-accent peer-checked:bg-accent/15 peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {a}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
