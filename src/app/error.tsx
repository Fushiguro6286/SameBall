"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { reportError } from "@/lib/client/report-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => reportError(error), [error]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-4xl">{t.errors.crashTitle}</h1>
      <p className="text-muted">{t.errors.crashBody}</p>
      <button onClick={reset} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">
        {t.errors.reload}
      </button>
    </main>
  );
}
