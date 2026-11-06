"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Bottom sheet on a native <dialog>: focus trap, Esc and backdrop close for free. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-0 text-foreground shadow-2xl"
    >
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <h2 id={titleId} className="font-display text-3xl">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
