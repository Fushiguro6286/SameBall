"use client";

import { useEffect, useState } from "react";
import { FEATURES, SPORTS } from "@/lib/config";
import { useT } from "@/lib/i18n/client";

interface AdminRoom {
  code: string;
  name: string;
  sport: string;
  kind: string;
  members: number;
  featured: boolean;
  startsAt: string | null;
}

/** Feature rooms and post anchors. The token stays in this tab only. */
export function AdminPanel() {
  const t = useT();
  const [token, setToken] = useState("");
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState({ label: "Kick-off", lagS: 0 });
  const [done, setDone] = useState<string | null>(null);
  const [stadium, setStadium] = useState({ name: "", sport: "cricket" });
  const [score, setScore] = useState("");
  const [autoScore, setAutoScore] = useState<string | null>(null);

  const call = async (method: "GET" | "POST", payload?: unknown) => {
    setError(null);
    const res = await fetch("/api/admin", {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (res.status === 401) throw new Error(t.admin.denied);
    if (!res.ok) throw new Error(t.errors.generic);
    return res.json();
  };
  const load = () =>
    call("GET")
      .then((d) => setRooms(d.rooms))
      .catch((e: Error) => setError(e.message));
  const act = (payload: object, note: string) =>
    call("POST", payload)
      .then(() => (setDone(note), load()))
      .catch((e: Error) => setError(e.message));

  // Polls the score provider while this tab is open and posts each new line to the chosen room.
  // shortcut: driven by the admin tab, not a server scheduler; move to a cron/queue if this goes beyond demos.
  useEffect(() => {
    if (!autoScore) return;
    const tick = () => act({ action: "score", code: autoScore, text: "", lagS: 0 }, `${autoScore}: ${t.admin.scoreAuto}`);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the room changes
  }, [autoScore]);

  return (
    <div className="mt-6 space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label htmlFor="admin-token" className="sr-only">
          {t.admin.token}
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t.admin.token}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2.5"
        />
        <button className="rounded-full bg-accent px-4 font-semibold text-accent-ink">{t.admin.load}</button>
      </form>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {done && <p role="status" className="text-accent">{done}</p>}
      {rooms && FEATURES.stadiums && (
        <form
          className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            call("POST", { action: "stadium", name: stadium.name.trim(), sport: stadium.sport })
              .then((d: { code: string }) => (setDone(t.admin.stadiumCreated(d.code)), setStadium({ ...stadium, name: "" }), load()))
              .catch((err: Error) => setError(err.message));
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="block text-muted">{t.admin.stadiumName}</span>
            <input
              value={stadium.name}
              maxLength={60}
              onChange={(e) => setStadium({ ...stadium, name: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2"
            />
          </label>
          <select
            aria-label={t.create.sportLabel}
            value={stadium.sport}
            onChange={(e) => setStadium({ ...stadium, sport: e.target.value })}
            className="self-end rounded-lg border border-line bg-surface-2 px-3 py-2"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {t.sports[s]}
              </option>
            ))}
          </select>
          <button disabled={!stadium.name.trim()} className="self-end rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-40">
            {t.admin.createStadium}
          </button>
        </form>
      )}
      {rooms && (
        <>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
            <label className="flex-1">
              <span className="block text-muted">{t.admin.anchorLabel}</span>
              <input
                value={anchor.label}
                maxLength={40}
                onChange={(e) => setAnchor({ ...anchor, label: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2"
              />
            </label>
            <label className="w-32">
              <span className="block text-muted">{t.admin.anchorLag}</span>
              <input
                type="number"
                min={0}
                value={anchor.lagS}
                onChange={(e) => setAnchor({ ...anchor, lagS: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2"
              />
            </label>
            {FEATURES.scoreStrip && (
              <label className="w-full">
                <span className="block text-muted">{t.admin.scoreLabel}</span>
                <input
                  value={score}
                  maxLength={40}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="IND 158/6 (19.2)"
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2"
                />
              </label>
            )}
          </div>
          <ul className="space-y-2">
            {rooms.map((r) => (
              <li key={r.code} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{r.name}</span>{" "}
                  <span className="text-muted">
                    {r.kind === "stadium" && `${t.stadium.badge} · `}
                    {r.code} · {r.sport} · {r.members}
                    {r.startsAt && ` · ${new Date(r.startsAt).toLocaleString()}`}
                  </span>
                </span>
                <button
                  onClick={() => act({ action: "feature", code: r.code, featured: !r.featured }, `${r.code}: ${r.featured ? t.admin.unfeature : t.admin.feature}`)}
                  className={`rounded-full px-3 py-1.5 ${r.featured ? "bg-accent text-accent-ink" : "border border-line"}`}
                >
                  {r.featured ? t.admin.unfeature : t.admin.feature}
                </button>
                <button
                  disabled={!anchor.label.trim()}
                  onClick={() => act({ action: "anchor", code: r.code, label: anchor.label.trim(), lagS: anchor.lagS }, `${r.code}: ${anchor.label}`)}
                  className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40"
                >
                  {t.admin.anchor}
                </button>
                {FEATURES.scoreStrip && (
                  <>
                    <button
                      disabled={!score.trim()}
                      onClick={() => act({ action: "score", code: r.code, text: score.trim(), lagS: anchor.lagS }, `${r.code}: ${score}`)}
                      className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40"
                    >
                      {t.admin.scorePost}
                    </button>
                    <button
                      aria-pressed={autoScore === r.code}
                      onClick={() => setAutoScore(autoScore === r.code ? null : r.code)}
                      className={`rounded-full px-3 py-1.5 ${autoScore === r.code ? "bg-accent text-accent-ink" : "border border-line"}`}
                    >
                      {t.admin.scoreAuto}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
