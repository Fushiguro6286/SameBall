"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, startTryApi } from "@/lib/client/api";
import { setMetricsUser } from "@/lib/client/metrics";
import { loadProfile, rememberRoom, saveProfile } from "@/lib/client/storage";
import { t } from "@/lib/i18n";

/** One tap: create the demo room (reusing this browser's guest if any) and go there. */
export function TryStart() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = loadProfile();
      const res = await startTryApi({ guestId: p?.guestId, name: p?.name, avatar: p?.avatar });
      saveProfile({ guestId: res.guestId, name: res.name, avatar: res.avatar });
      setMetricsUser(res.guestId);
      rememberRoom({ code: res.code, name: t.try.panelLabel });
      router.push(`/r/${res.code}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <button onClick={go} disabled={busy} className="w-full rounded-full bg-accent py-3.5 text-lg font-semibold text-accent-ink disabled:opacity-60">
        {busy ? t.try.going : t.try.go}
      </button>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </>
  );
}
