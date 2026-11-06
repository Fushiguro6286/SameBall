"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

const card = "pop-in border-b border-line bg-surface-2 px-4 py-3";

/** First join: three things that keep a match spoiler-free. Dismissed once per browser. */
export function PrematchChecklist({ onFeed, onInvite, onDone }: { onFeed: () => void; onInvite: () => void; onDone: () => void }) {
  const t = useT();
  const c = t.checklist;
  return (
    <section aria-labelledby="prematch" className={card}>
      <div className="mx-auto max-w-xl text-sm">
        <div className="flex items-start gap-2">
          <h2 id="prematch" className="min-w-0 flex-1 font-semibold">
            {c.title}
          </h2>
          <button onClick={onDone} aria-label={t.lag.close} className="px-1 text-lg leading-none text-muted">
            ×
          </button>
        </div>
        <ul className="mt-2 space-y-1.5">
          <li>🔕 {c.mute}</li>
          <li className="flex items-center gap-2">
            <span className="flex-1">⏱ {c.feed}</span>
            <button onClick={onFeed} className="rounded-full border border-line px-3 py-1 text-xs">
              {c.feedCta}
            </button>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex-1">👥 {c.invite}</span>
            <button onClick={onInvite} className="rounded-full border border-line px-3 py-1 text-xs">
              {c.inviteCta}
            </button>
          </li>
        </ul>
        <button onClick={onDone} className="mt-3 rounded-full bg-accent px-4 py-1.5 font-semibold text-accent-ink">
          {c.done}
        </button>
      </div>
    </section>
  );
}

/** Nobody else has joined yet (but I've already chatted, so the empty state is gone). */
export function AloneCard({ onInvite, onDismiss }: { onInvite: () => void; onDismiss: () => void }) {
  const t = useT();
  return (
    <section aria-labelledby="alone" className={card}>
      <div className="mx-auto max-w-xl text-sm">
        <div className="flex items-start gap-2">
          <p id="alone" className="min-w-0 flex-1">
            <span className="font-semibold">{t.alone.title}</span> {t.alone.body}
          </p>
          <button onClick={onDismiss} aria-label={t.lag.close} className="px-1 text-lg leading-none text-muted">
            ×
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={onInvite} className="rounded-full bg-accent px-4 py-1.5 font-semibold text-accent-ink">
            {t.alone.invite}
          </button>
          <TryDemoLink />
        </div>
      </div>
    </section>
  );
}

/** Opens Judge Mode: a separate private room with two clearly labelled bot friends (never counted in stats). */
export function TryDemoLink() {
  const t = useT();
  return (
    <Link href="/try" className="rounded-full border border-line px-4 py-1.5">
      🤖 {t.alone.demo}
    </Link>
  );
}
