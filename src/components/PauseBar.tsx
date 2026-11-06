"use client";

import { useNow } from "@/lib/client/useNow";
import { useT } from "@/lib/i18n/client";

/** My stream is paused (or in an ad break): the chat waits with me. "I'm back" adds the pause to my delay. */
export function PauseBar({ since, onBack, onLive }: { since: number; onBack: () => void; onLive: () => void }) {
  const t = useT();
  const now = useNow(true, 1000);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <section role="status" className="border-b border-line bg-surface-2 px-4 py-3">
      <div className="mx-auto max-w-xl text-sm">
        <p>
          <span className="font-semibold">⏸ {t.pause.paused(clock)}</span> {t.pause.waits}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={onBack} className="rounded-full bg-accent px-4 py-1.5 font-semibold text-accent-ink">
            {t.pause.back}
          </button>
          <button onClick={onLive} className="rounded-full border border-line px-4 py-1.5">
            {t.pause.live}
          </button>
        </div>
      </div>
    </section>
  );
}
