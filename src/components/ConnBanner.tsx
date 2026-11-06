"use client";

import { t } from "@/lib/i18n";
import type { RoomStatus } from "@/lib/room/useRoom";

export function ConnBanner({ status, isDemo, onRetry }: { status: RoomStatus; isDemo: boolean; onRetry: () => void }) {
  return (
    <>
      {isDemo && (
        <div role="status" className="bg-danger px-4 py-1.5 text-center text-xs font-bold tracking-wide text-black">
          {t.conn.demo}
        </div>
      )}
      {status !== "connected" && (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 bg-surface-2 px-4 py-2 text-sm">
          <span>{status === "failed" ? t.conn.failed : t.conn[status]}</span>
          {status === "failed" && (
            <button onClick={onRetry} className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-ink">
              {t.conn.retry}
            </button>
          )}
        </div>
      )}
    </>
  );
}
