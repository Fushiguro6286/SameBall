"use client";

import { useNow } from "@/lib/client/useNow";
import { googleCalendarUrl, icsFile } from "@/lib/calendar";
import { useT } from "@/lib/i18n/client";

/** Countdown for a scheduled room, with Add to calendar. Hidden once the match starts. */
export function StartBanner({ startsAt, roomName, code, url }: { startsAt: number; roomName: string; code: string; url: string }) {
  const t = useT();
  const now = useNow(true, 1000);
  const left = startsAt - now;
  if (left <= 0) return null;
  const downloadIcs = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([icsFile(roomName, startsAt, url, code)], { type: "text/calendar" }));
    a.download = `sameball-${code}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <section className="border-b border-line bg-surface px-4 py-3">
      <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2">
        <p className="flex-1 text-sm">
          <span className="font-semibold text-accent">{t.schedule.startsIn(left)}</span>{" "}
          <span className="text-muted">· {new Date(startsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
        </p>
        <a href={googleCalendarUrl(roomName, startsAt, url)} target="_blank" rel="noopener" className="rounded-full border border-line px-3 py-1.5 text-xs">
          {t.schedule.google}
        </a>
        <button onClick={downloadIcs} className="rounded-full border border-line px-3 py-1.5 text-xs">
          {t.schedule.ics}
        </button>
      </div>
    </section>
  );
}
