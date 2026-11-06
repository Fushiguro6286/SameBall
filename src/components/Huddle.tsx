"use client";

import { useT } from "@/lib/i18n/client";
import { huddleGate, type HuddleMember } from "@/lib/timing/huddle";
import { Sheet } from "./Sheet";

/** Gated Huddle: shows whether the squad is in step. Voice itself waits on Nexconn Call (see WRITEUP). */
export function HuddleSheet({ open, onClose, members, myId, onSync }: { open: boolean; onClose: () => void; members: HuddleMember[]; myId: string; onSync: () => void }) {
  const t = useT();
  const g = huddleGate(members);
  return (
    <Sheet open={open} onClose={onClose} title={t.huddle.title}>
      <div className="mt-3 space-y-3 text-sm">
        <p aria-live="polite" className={`rounded-2xl px-3 py-2 ${g.open ? "border border-accent/60 bg-accent/10" : "bg-surface-2"}`}>
          {g.count < 2 ? t.huddle.alone : g.open ? t.huddle.open : t.huddle.locked(Math.round(g.spreadMs / 1000))}
        </p>
        {!g.open && g.off.length > 0 && (
          <ul className="space-y-1">
            {g.off.map((o) => (
              <li key={o.senderId} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span>
                  {o.name}
                  {o.senderId === myId && <span className="text-muted"> ({t.room.you})</span>}
                </span>
                <span className="tabular-nums text-muted">{o.byMs > 0 ? t.huddle.behind(Math.round(o.byMs / 1000)) : t.huddle.ahead(Math.round(-o.byMs / 1000))}</span>
              </li>
            ))}
          </ul>
        )}
        {!g.open && (
          <button onClick={() => (onClose(), onSync())} className="w-full rounded-full border border-line px-4 py-2">
            {t.huddle.sync}
          </button>
        )}
        <p className="text-xs text-muted">{t.huddle.voiceSoon}</p>
      </div>
    </Sheet>
  );
}
