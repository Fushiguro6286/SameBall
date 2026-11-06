"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Auth } from "@/lib/client/api";
import { track } from "@/lib/client/metrics";
import { useT } from "@/lib/i18n/client";
import type { CallPoints } from "@/lib/timing/callit";
import type { Moment } from "@/lib/timing/wave";
import { NexconnBadge } from "./NexconnBadge";
import { Sheet } from "./Sheet";

/** Same shape as the server's Recap (lib/recap.ts). Counts and names only, never messages. */
export interface RecapData {
  code: string;
  name: string;
  fans: number;
  messages: number;
  spoilers: number;
  roars: number;
  topRoarer: { name: string; avatar: string; roars: number } | null;
  spreadS: number | null;
  slowest: { name: string; avatar: string; lagS: number } | null;
}

function Stats({ r, extra }: { r: RecapData; extra?: React.ReactNode }) {
  const t = useT();
  const tiles: [string, string][] = [
    [t.recap.spoilers, String(r.spoilers)],
    [t.recap.fans, String(r.fans)],
    [t.recap.messages, String(r.messages)],
    [t.recap.roars, String(r.roars)],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface-2 p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-display text-3xl text-accent">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 space-y-1.5 text-sm">
        {r.topRoarer && <li>{t.recap.loudest(`${r.topRoarer.avatar} ${r.topRoarer.name}`, r.topRoarer.roars)}</li>}
        {r.slowest && r.spreadS !== null && r.spreadS > 0 && <li>{t.recap.slowest(`${r.slowest.avatar} ${r.slowest.name}`, r.spreadS)}</li>}
        {extra}
      </ul>
    </>
  );
}

function ShareRecap({ code, name, origin }: { code: string; name: string; origin: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = `${origin}/r/${code}/recap`;
  const shared = (via: string) => track("recap_shared", code, { via });

  const story = async () => {
    setBusy(true);
    try {
      const blob = await fetch(`/r/${code}/recap/story`).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
      const file = new File([blob], "sameball-recap.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${t.recap.shareText(name)} ${url}` });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      shared("story");
    } catch {
      // cancelled or failed: nothing to do
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${t.recap.shareText(name)} ${url}`)}`}
        target="_blank"
        rel="noopener"
        onClick={() => shared("whatsapp")}
        className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink"
      >
        {t.empty.whatsapp}
      </a>
      <button onClick={story} disabled={busy} className="rounded-full border border-line bg-surface-2 px-4 py-2 disabled:opacity-60">
        {busy ? t.recap.loading : t.recap.story}
      </button>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            shared("copy");
          } catch {
            window.prompt(t.empty.copy, url);
          }
        }}
        className="rounded-full border border-line bg-surface-2 px-4 py-2"
      >
        <span aria-live="polite">{copied ? t.empty.copied : t.empty.copy}</span>
      </button>
    </div>
  );
}

const surveyKey = (code: string) => `sb-survey:${code}`;

/** End-of-match survey: 2 taps + an optional line. Stored on our server (feedback table), once per room. */
function Survey({ auth, code }: { auth: Auth; code: string }) {
  const t = useT();
  const s = t.recap.survey;
  const [done, setDone] = useState(() => {
    try {
      return !!localStorage.getItem(surveyKey(code));
    } catch {
      return false;
    }
  });
  const [spoiled, setSpoiled] = useState<boolean | null>(null);
  const [again, setAgain] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [failed, setFailed] = useState(false);
  if (done) return <p className="text-sm text-muted">{s.thanks}</p>;

  const send = async () => {
    setFailed(false);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, roomCode: code, helpful: !spoiled, spoiled: !!spoiled, again: !!again, comment: comment.trim() || undefined }),
    }).catch(() => null);
    if (!res?.ok) return setFailed(true);
    try {
      localStorage.setItem(surveyKey(code), "1");
    } catch {
      // ignore
    }
    setDone(true);
  };
  const yesNo = (v: boolean | null, set: (b: boolean) => void) => (
    <div className="mt-1 flex gap-2">
      {([true, false] as const).map((b) => (
        <button
          key={String(b)}
          aria-pressed={v === b}
          onClick={() => set(b)}
          className="rounded-full border border-line px-4 py-1.5 aria-pressed:border-accent aria-pressed:bg-accent/15"
        >
          {b ? t.call.yes : t.call.no}
        </button>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="survey" className="rounded-2xl border border-line p-3 text-sm">
      <h3 id="survey" className="font-semibold">
        {s.title}
      </h3>
      <p className="mt-2">{s.spoiled}</p>
      {yesNo(spoiled, setSpoiled)}
      <p className="mt-3">{s.again}</p>
      {yesNo(again, setAgain)}
      <label className="mt-3 block">
        <span className="sr-only">{s.comment}</span>
        <input
          value={comment}
          maxLength={200}
          onChange={(e) => setComment(e.target.value)}
          placeholder={s.comment}
          className="w-full rounded-full border border-line bg-surface-2 px-4 py-2"
        />
      </label>
      <button
        onClick={send}
        disabled={spoiled === null || again === null}
        className="mt-3 rounded-full bg-accent px-4 py-1.5 font-semibold text-accent-ink disabled:opacity-50"
      >
        {s.send}
      </button>
      {failed && <p className="mt-2 text-danger">{t.errors.generic}</p>}
    </section>
  );
}

type Load = { kind: "loading" } | { kind: "done"; r: RecapData } | { kind: "error" };

/** In-room recap: squad numbers from our server plus Call it and The Wave from what's revealed on this screen. */
export function RecapSheet({
  open,
  onClose,
  code,
  auth,
  origin,
  board,
  moments,
  onWave,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  auth: Auth | null;
  origin: string;
  board: CallPoints[];
  moments: Moment[];
  onWave?: () => void;
}) {
  const t = useT();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  useEffect(() => {
    if (!open) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for each opening
    setLoad({ kind: "loading" });
    fetch(`/api/recap?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((r: RecapData) => live && setLoad({ kind: "done", r }))
      .catch(() => live && setLoad({ kind: "error" }));
    track("recap_opened", code, { from: "room" });
    return () => {
      live = false;
    };
  }, [open, code]);

  const streak = [...board].sort((a, b) => b.best - a.best)[0];
  const big = [...moments].sort((a, b) => b.reactors.length - a.reactors.length)[0];
  const extra = (
    <>
      {streak && streak.best > 0 && <li>{t.recap.streak(`${streak.avatar} ${streak.name}`, streak.best)}</li>}
      {big && (
        <li className="flex flex-wrap items-center gap-2">
          {t.recap.wave(big.reactors.length)}
          {onWave && (
            <button onClick={onWave} className="rounded-full border border-accent/60 px-3 py-0.5 text-accent">
              {t.recap.seeWave}
            </button>
          )}
        </li>
      )}
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t.recap.title}>
      <div className="mt-3 space-y-4">
        {load.kind === "loading" && <p className="text-muted">{t.recap.loading}</p>}
        {load.kind === "error" && <p className="text-danger">{t.errors.generic}</p>}
        {load.kind === "done" && (
          <>
            <Stats r={load.r} extra={extra} />
            {origin && <ShareRecap code={code} name={load.r.name} origin={origin} />}
          </>
        )}
        {auth && <Survey auth={auth} code={code} />}
      </div>
    </Sheet>
  );
}

/** Public /r/CODE/recap page: what a shared recap link opens. */
export function RecapLanding({ r }: { r: RecapData }) {
  const t = useT();
  const tracked = useRef(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window is browser-only
    setOrigin(window.location.origin);
    if (!tracked.current) {
      tracked.current = true;
      track("recap_opened", r.code, { from: "link" });
    }
  }, [r.code]);
  return (
    <main className="floodlight mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-muted">
        ← {t.appName}
      </Link>
      <p className="mt-4 font-display text-xl tracking-widest text-accent">{t.recap.title}</p>
      <h1 className="font-display text-5xl leading-none">{r.name}</h1>
      <div className="mt-6">
        <Stats r={r} />
      </div>
      <section className="mt-8 rounded-3xl border border-accent/40 bg-surface p-5">
        <h2 className="font-display text-3xl">{t.recap.join}</h2>
        <p className="mt-1 text-sm text-muted">{t.recap.joinBody}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/r/${r.code}`} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink">
            {t.recap.joinCta}
          </Link>
          <Link href="/try" className="rounded-full border border-line px-5 py-2.5">
            {t.landing.tryIt}
          </Link>
        </div>
      </section>
      {origin && (
        <div className="mt-6">
          <ShareRecap code={r.code} name={r.name} origin={origin} />
        </div>
      )}
      <NexconnBadge className="mt-8" />
    </main>
  );
}
