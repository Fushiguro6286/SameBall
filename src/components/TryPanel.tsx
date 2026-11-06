"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, tryStartApi, tryStepApi, type Auth } from "@/lib/client/api";
import { useNow } from "@/lib/client/useNow";
import { useT } from "@/lib/i18n/client";
import { HYPE_HIGH, hypeHeat, type Pending } from "@/lib/timing/hype";
import { TRY_ANCHOR_LABEL, TRY_BALLS, TRY_BOTS, TRY_END_T, TRY_SIX_T, TRY_STEPS, TRY_TARGET, TRY_TEAMS, scoreAt, type BallResult } from "@/lib/try-script";
import type { Anchor } from "@/lib/room/useRoom";

const BOT_IDS = new Set<string>(Object.values(TRY_BOTS).map((b) => b.id));

const ballLabel = (r: BallResult) => (r === "W" ? "W" : r === 0 ? "•" : String(r));

/**
 * Judge Mode: a scripted over that plays on *my* screen at my lag, while bots on the fastest feed react.
 * The bots' messages are sent by the server as each moment happens; this component only asks for them on time.
 */
export function TryPanel({
  auth,
  code,
  anchors,
  lagMs,
  clockOffset,
  lockedCount,
  pending,
  heldBack,
  ready,
}: {
  auth: Auth;
  code: string;
  anchors: Anchor[];
  lagMs: number;
  clockOffset: number;
  lockedCount: number;
  pending: Pending[];
  heldBack: number;
  ready: boolean;
}) {
  const t = useT();
  const { guestId, key } = auth;
  const start = anchors.find((a) => a.label === TRY_ANCHOR_LABEL && BOT_IDS.has(a.senderId))?.matchTime ?? null;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const now = useNow(start !== null || starting, 250, clockOffset);
  const requested = useRef(new Set<number>());

  // Ask the server for each bot step once its moment arrives on the fastest feed.
  useEffect(() => {
    if (start === null) return;
    const tick = () => {
      const serverNow = Date.now() + clockOffset;
      TRY_STEPS.forEach((s, i) => {
        if (requested.current.has(i) || serverNow < start + s.t * 1000) return;
        requested.current.add(i);
        tryStepApi({ guestId, key }, code, i).catch((e) => {
          // Too early (clock skew) or a hiccup: try again on a later tick.
          setTimeout(() => requested.current.delete(i), e instanceof ApiError && e.status === 425 ? 300 : 2000);
        });
      });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [start, clockOffset, guestId, key, code]);

  const begin = async () => {
    setStarting(true);
    setError(false);
    try {
      await tryStartApi({ guestId, key }, code);
    } catch {
      setError(true);
      setStarting(false);
    }
  };

  const lagS = Math.round(lagMs / 1000);
  const matchT = start === null ? null : (now - start - lagMs) / 1000; // what MY screen shows
  const score = scoreAt(matchT ?? -1);
  const flash = score.last && matchT !== null && matchT - score.last.t < 2.5 ? score.last.result : null;
  const done = matchT !== null && matchT >= TRY_END_T && lockedCount === 0;
  const high = hypeHeat(pending, now).heat >= HYPE_HIGH;

  let coach: string;
  if (start === null) coach = t.try.coachPick;
  else if (lagS === 0) coach = t.try.coachFastest;
  else if (matchT !== null && matchT < 0) coach = t.try.coachBehind(lagS, Math.ceil(-matchT));
  else if (matchT !== null && matchT >= TRY_SIX_T && matchT < TRY_SIX_T + 6) coach = t.try.coachSix;
  else if (high) coach = t.try.coachHype;
  else if (lockedCount > 0 && matchT !== null && matchT > TRY_SIX_T) coach = t.try.coachSpoil;
  else if (lockedCount > 0) coach = t.try.coachFuture;
  else coach = t.try.coachWatch;

  if (done) {
    return (
      <section aria-live="polite" className="pop-in border-b border-line bg-surface px-4 py-4 text-center">
        <p className="font-display text-3xl leading-tight">{t.try.summary(heldBack)}</p>
        <p className="mt-1 text-sm text-muted">{t.try.summaryBody}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href="/#create" className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink">
            {t.try.createCta}
          </Link>
          <Link href="/try" className="rounded-full border border-line px-5 py-2.5">
            {t.try.again}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t.try.panelLabel} className="border-b border-line bg-surface px-3 py-2.5">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {TRY_TEAMS.bat} {TRY_TARGET.score} · {t.try.vs} {TRY_TEAMS.bowl}
            </p>
            <p className="font-display text-2xl leading-none">
              {score.need === 0 ? t.try.won(TRY_TEAMS.bat) : t.try.need(score.need, score.ballsLeft)}
            </p>
          </div>
          <ol aria-label={t.try.thisOver} className="flex gap-1">
            {TRY_BALLS.map((b, i) => {
              const r = score.bowled[i]?.result;
              return (
                <li
                  key={b.t}
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                    r === undefined ? "border border-line text-muted" : r === 6 || r === 4 ? "bg-accent text-accent-ink" : r === "W" ? "bg-danger text-black" : "bg-surface-2"
                  }`}
                >
                  {r === undefined ? "" : ballLabel(r)}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="relative mt-2 flex h-9 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(90deg,#0d3b1f,#14532d_50%,#0d3b1f)]">
          <div aria-hidden className="absolute inset-y-1 left-1/2 w-10 -translate-x-1/2 rounded bg-[#c8b07a]/50" />
          <span className="relative text-xs font-semibold text-white/80">{t.try.feedLabel(lagS)}</span>
          {flash !== null && (
            <span key={String(score.last?.t)} className="reveal-flash absolute inset-0 grid place-items-center bg-black/40 font-display text-3xl text-accent">
              {t.try.result(flash)}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm">{coach}</p>
        {start === null ? (
          <button
            onClick={begin}
            disabled={!ready || starting}
            className="mt-2 w-full rounded-full bg-accent py-2.5 font-semibold text-accent-ink disabled:opacity-50"
          >
            {starting ? t.try.starting : t.try.start}
          </button>
        ) : (
          <a href={`/r/${code}?second=1`} target="_blank" rel="noopener" className="mt-1 inline-block text-xs text-muted underline underline-offset-4">
            {t.try.second}
          </a>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {t.errors.chat}
          </p>
        )}
      </div>
    </section>
  );
}
