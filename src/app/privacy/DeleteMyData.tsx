"use client";

import { useState } from "react";
import { clearAll, loadProfile } from "@/lib/client/storage";
import { t } from "@/lib/i18n";

export function DeleteMyData() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "none" | "error">("idle");
  const del = async () => {
    const profile = loadProfile();
    const id = profile?.guestId;
    if (!id) {
      clearAll();
      return setState("none");
    }
    setState("busy");
    const res = await fetch("/api/privacy/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: id, key: profile?.key }),
    }).catch(() => null);
    if (!res?.ok) return setState("error");
    clearAll();
    setState("done");
  };
  return (
    <div className="mt-4">
      <button
        onClick={del}
        disabled={state === "busy" || state === "done"}
        className="rounded-full bg-danger px-5 py-2.5 font-semibold text-black disabled:opacity-60"
      >
        {state === "busy" ? t.privacy.deleting : t.privacy.deleteButton}
      </button>
      <p role="status" className="mt-3 text-sm">
        {state === "done" ? t.privacy.deleted : state === "none" ? t.privacy.nothing : state === "error" ? t.errors.generic : ""}
      </p>
    </div>
  );
}
