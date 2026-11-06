"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalibrationCard } from "@/components/CalibrationCard";
import { ChatTimeline } from "@/components/ChatTimeline";
import { Composer } from "@/components/Composer";
import { ConnBanner } from "@/components/ConnBanner";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { GhostPanel } from "@/components/GhostPanel";
import { HypeStrip } from "@/components/HypeStrip";
import { LagBoard, useWatching } from "@/components/LagBoard";
import { RoarButton } from "@/components/RoarButton";
import { StartBanner } from "@/components/StartBanner";
import { SyncCheckCard, SyncStartSheet } from "@/components/SyncCheck";
import { Toggle } from "@/components/Toggle";
import { TryPanel } from "@/components/TryPanel";
import { WaveSheet } from "@/components/WaveSheet";
import { Crowd } from "@/lib/audio/crowd";
import { InvitePanel } from "@/components/InvitePanel";
import { LagSheet } from "@/components/LagSheet";
import { ProfileFields } from "@/components/ProfileFields";
import { Sheet } from "@/components/Sheet";
import { errorText, startSession } from "@/lib/client/api";
import { setMetricsUser, track } from "@/lib/client/metrics";
import { loadBlocked, loadProfile, loadRoomPrefs, loadSetting, rememberRoom, saveBlocked, saveProfile, saveSetting } from "@/lib/client/storage";
import { AVATARS, FEATURES, LAG_SOURCES, QUICK_CHIPS, asSport, type Sport } from "@/lib/config";
import { useNow } from "@/lib/client/useNow";
import { t } from "@/lib/i18n";
import { useRoom, type RoomSession } from "@/lib/room/useRoom";
import { suggestLag } from "@/lib/timing/calibration";

const DEFAULT_SOURCE = LAG_SOURCES.find((s) => s.id === "streaming")!;
const TV_SOURCE = LAG_SOURCES.find((s) => s.id === "tv")!;
const REPLAY_AHEAD_MS = 30_000;
const WAVE_FRESH_MS = 3 * 60_000;

function demoGuestId(): string {
  // Per tab, so two demo tabs act as two different people.
  try {
    let id = sessionStorage.getItem("sb-demo-id");
    if (!id) {
      id = "g_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      sessionStorage.setItem("sb-demo-id", id);
    }
    return id;
  } catch {
    return "g_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
}

// Judge Mode "second window": a separate per-tab guest on the TV feed, flagged as test so one person isn't counted twice.
const SECOND_KEY = (code: string) => `sb-second:${code}`;
function readSecond(code: string): { guestId?: string; key?: string } {
  try {
    return JSON.parse(sessionStorage.getItem(SECOND_KEY(code)) ?? "{}");
  } catch {
    return {};
  }
}
function saveSecond(code: string, guestId: string, key: string) {
  try {
    sessionStorage.setItem(SECOND_KEY(code), JSON.stringify({ guestId, key }));
  } catch {
    // ignore
  }
}

export function RoomClient({
  code,
  roomName,
  sport,
  kind = "room",
  startsAt,
  ownerId,
  demo,
}: {
  code: string;
  roomName: string;
  sport: string;
  kind?: string;
  startsAt?: number;
  ownerId?: string;
  demo: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const second = kind === "try" && params.get("second") === "1";
  const replay = FEATURES.ghostCrowd && kind !== "try" && params.get("replay") === "1";
  const [phase, setPhase] = useState<"init" | "join" | "joining" | "room">("init");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState(roomName);

  const join = async (n: string, a: string) => {
    setPhase("joining");
    setError(null);
    try {
      if (demo) {
        setSession({ code, channelId: code, guestId: demoGuestId(), name: n, avatar: a, demo: true });
        setPhase("room");
        return;
      }
      const prev = loadProfile();
      const ref = params.get("ref") ?? undefined;
      const res = await startSession({
        ...(second ? readSecond(code) : { guestId: prev?.guestId, key: prev?.key }),
        name: n,
        avatar: a as (typeof AVATARS)[number],
        roomCode: code,
        ref: !second && ref && /^g_[A-Za-z0-9]{20}$/.test(ref) ? ref : undefined,
        test: second || undefined,
      });
      if (second) saveSecond(code, res.guestId, res.key);
      else saveProfile({ guestId: res.guestId, key: res.key, name: n, avatar: a });
      setMetricsUser(res.guestId);
      const room = res.room!;
      if (!second) rememberRoom({ code: room.code, name: room.name });
      setCurrentName(room.name);
      track("joined", room.code);
      if (room.redirectedFrom) {
        setNotice(t.join.redirected(room.name));
        router.replace(`/r/${room.code}`);
      }
      setSession({
        code: room.code,
        channelId: room.channelId,
        guestId: res.guestId,
        key: res.key,
        name: n,
        avatar: a,
        demo: false,
        token: res.token,
        appKey: res.appKey,
        area: res.area,
        ephemeral: second,
      });
      setPhase("room");
    } catch (e) {
      setError(errorText(e));
      setPhase("join");
    }
  };

  // Returning visitors with a saved profile skip the form.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current) return;
    autoJoined.current = true;
    if (second) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auto-join for the second screen
      join(t.try.secondName, "⚡");
      return;
    }
    const p = loadProfile();
    if (p?.name) setName(p.name);
    if (p?.avatar) setAvatar(p.avatar);
    if (p?.name && p.avatar && (demo || p.guestId)) join(p.name, p.avatar);
    else setPhase("join");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "room" && session)
    return (
      <RoomView
        key={replay ? "replay" : "live"}
        session={session}
        roomName={currentName}
        sport={asSport(sport)}
        isTry={kind === "try"}
        second={second}
        replay={replay}
        startsAt={startsAt}
        ownerId={ownerId}
        notice={notice}
      />
    );

  return (
    <main className="floodlight flex flex-1 flex-col items-center justify-center px-4 py-10">
      {phase === "init" ? (
        <p className="text-muted">{t.room.loading}</p>
      ) : (
        <form
          className="w-full max-w-sm space-y-5 rounded-3xl border border-line bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) join(name.trim(), avatar);
          }}
        >
          <div>
            <h1 className="font-display text-4xl leading-none">{t.join.title(roomName)}</h1>
            <p className="mt-2 text-sm text-muted">{t.join.subtitle}</p>
          </div>
          <ProfileFields name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
          {error && (
            <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <button disabled={phase === "joining"} className="w-full rounded-full bg-accent py-3 font-semibold text-accent-ink disabled:opacity-60">
            {phase === "joining" ? t.join.joining : t.join.submit}
          </button>
        </form>
      )}
    </main>
  );
}

function RoomView({
  session,
  roomName,
  sport,
  isTry,
  second,
  replay,
  startsAt,
  ownerId,
  notice,
}: {
  session: RoomSession;
  roomName: string;
  sport: Sport;
  isTry: boolean;
  second: boolean;
  replay: boolean;
  startsAt?: number;
  ownerId?: string;
  notice: string | null;
}) {
  const params = useSearchParams();
  const [prefs] = useState(() => {
    if (second) return { lagMs: TV_SOURCE.seconds * 1000, source: TV_SOURCE.id as string, first: false };
    const saved = loadRoomPrefs(session.code);
    const devLag = session.demo ? Number(params.get("lag")) : NaN; // ?lag=25 (seconds), demo only
    if (Number.isFinite(devLag) && params.get("lag") !== null) return { lagMs: devLag * 1000, source: "custom", first: false };
    return saved ? { ...saved, first: false } : { lagMs: DEFAULT_SOURCE.seconds * 1000, source: DEFAULT_SOURCE.id as string, first: true };
  });
  const crowd = useRef<Crowd | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [glow, setGlow] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [muted, setMuted] = useState(() => loadSetting("muted", false));
  const [suspense, setSuspense] = useState(() => loadSetting("suspense", true));
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => new Set(loadBlocked()));
  const blockedRef = useRef(blocked);
  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);
  const toggleBlock = (id: string) => {
    const next = new Set(blocked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveBlocked([...next]);
    setBlocked(next);
  };
  const room = useRoom(session, prefs.lagMs, prefs.source, (r) => {
    if (blockedRef.current.has(r.senderId)) return;
    crowd.current ??= new Crowd();
    const { level, holdMs } = crowd.current.roar(r.intensity, r.senderId, r.dur);
    setGlow(level);
    if (glowTimer.current) clearTimeout(glowTimer.current);
    glowTimer.current = setTimeout(() => setGlow(0), holdMs);
  }, replay);
  const [synced, setSynced] = useState(false);
  // Replay shows only what's due within REPLAY_AHEAD_MS, so this re-renders as items come into range.
  const nowMs = useNow(replay && synced && !room.paused, 1000, room.clockOffset);
  useEffect(
    () => () => {
      crowd.current?.close();
      if (glowTimer.current) clearTimeout(glowTimer.current);
    },
    [],
  );
  const unlockSound = async () => {
    crowd.current ??= new Crowd();
    crowd.current.setMuted(muted);
    setSoundOn(await crowd.current.unlock());
  };
  const [source, setSource] = useState(prefs.source);
  const [lagOpen, setLagOpen] = useState(prefs.first && !replay);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [waveOpen, setWaveOpen] = useState(false);
  const [waveSeen, setWaveSeen] = useState<string | null>(null);
  /** Shared-moment count when the calibration hint was dismissed; it returns only after new evidence. */
  const [calDismissedAt, setCalDismissedAt] = useState(0);
  const [origin, setOrigin] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is browser-only
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/r/${session.code}${session.demo ? "?demo=1" : `?ref=${session.guestId}`}`;

  // Tab title shows counts only, never content.
  useEffect(() => {
    const counts = t.room.titleCounts(room.unseen, room.lockedCount);
    document.title = counts ? `(${counts}) ${roomName}` : roomName;
  }, [room.unseen, room.lockedCount, roomName]);

  const watching = useWatching(session.guestId, session.key ?? "", session.code, !replay && !session.demo && !!session.key);
  // My own entry always shows my current lag, even before my latest stamp goes out.
  const boardEntries = [
    ...room.lags.filter((l) => l.senderId !== session.guestId),
    { senderId: session.guestId, name: session.name, avatar: session.avatar, lag: room.lagMs },
  ];
  const lagS = Math.round(room.lagMs / 1000);
  let view = blocked.size ? room.view.filter((v) => !blocked.has(v.senderId)) : room.view;
  // A replay has hundreds of messages still ahead: show only the next few locked ones, none while paused or before sync.
  if (replay)
    view = view
      .filter((v) => !v.locked || (synced && !room.paused && v.revealAt - nowMs <= REPLAY_AHEAD_MS))
      .map((v) => (v.locked ? { ...v, lockedSince: Math.max(v.lockedSince, v.revealAt - REPLAY_AHEAD_MS) } : v));
  const pending = blocked.size ? room.pending.filter((p) => !blocked.has(p.senderId)) : room.pending;
  const empty = !replay && room.ready && room.view.length === 0;
  // The Wave: offer the latest moment while it's fresh on my screen. A replay viewer isn't part of the live squad's wave.
  const waveMembers = replay ? room.lags : boardEntries;
  const latestMoment = FEATURES.wave ? room.moments.at(-1) : undefined;
  const waveNow = useNow(!!latestMoment, 15_000, room.clockOffset);
  const lagHint = FEATURES.autoCalibration && !replay ? suggestLag(room.moments, session.guestId, room.lagMs) : null;
  const showWavePill = !!latestMoment && latestMoment.id !== waveSeen && waveNow - (latestMoment.matchTime + room.lagMs) < WAVE_FRESH_MS;
  const canChat = room.ready && (!replay || synced);

  return (
    <div className="flex h-dvh flex-col">
      <ConnBanner status={room.status} isDemo={room.isDemo} onRetry={room.retry} />
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Link href="/" aria-label={t.room.leaveHome} className="rounded-full px-2 py-1 text-xl text-muted">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl leading-tight">{roomName}</h1>
          {!replay && (
            <LagBoard
              entries={boardEntries}
              auth={session.key ? { guestId: session.guestId, key: session.key } : null}
              code={session.code}
              isOwner={!!ownerId && ownerId === session.guestId}
              watching={watching}
              blocked={blocked}
              onToggleBlock={toggleBlock}
            />
          )}
        </div>
        {!replay && (
          <button
            onClick={() => setLagOpen(true)}
            aria-label={`${t.room.lagButtonLabel}: ${t.room.lagBadge(lagS)}`}
            className="rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent"
          >
            ⏱ {t.room.lagBadge(lagS)}
          </button>
        )}
        <button onClick={() => setMenuOpen(true)} aria-label={t.room.menu} className="rounded-full px-2 py-1 text-xl">
          ⋯
        </button>
      </header>

      {notice && (
        <p role="status" className="bg-surface-2 px-4 py-2 text-center text-sm">
          {notice}
        </p>
      )}

      {isTry && (
        <TryPanel
          auth={{ guestId: session.guestId, key: session.key ?? "" }}
          code={session.code}
          anchors={room.anchors}
          lagMs={room.lagMs}
          clockOffset={room.clockOffset}
          lockedCount={room.lockedCount}
          pending={pending}
          heldBack={room.heldBack}
          ready={room.ready}
        />
      )}

      {replay && (
        <GhostPanel
          code={session.code}
          anchors={room.anchors}
          firstAt={room.firstAt}
          lockedCount={room.lockedCount}
          ready={room.ready}
          synced={synced}
          paused={room.paused}
          clockOffset={room.clockOffset}
          matchNow={room.matchNow}
          onSync={(lag) => {
            room.resume();
            room.setLag(lag, "replay");
            setSynced(true);
          }}
          onPause={room.pause}
          onResume={room.resume}
          onNudge={room.nudge}
          onResync={() => setSynced(false)}
        />
      )}

      {!replay && startsAt && origin && <StartBanner startsAt={startsAt} roomName={roomName} code={session.code} url={`${origin}/r/${session.code}`} />}

      {!replay && (
        <SyncCheckCard
          sync={room.sync}
          myId={session.guestId}
          lagMs={room.lagMs}
          clockOffset={room.clockOffset}
          roomCode={session.code}
          onTap={room.syncTap}
          onApply={(ms) => {
            setSource("custom");
            room.setLag(ms, "custom");
          }}
        />
      )}

      {empty && !isTry ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="font-display text-4xl">{t.empty.title}</h2>
          <p className="max-w-xs text-muted">{t.empty.body}</p>
          {origin && <InvitePanel url={inviteUrl} roomName={roomName} />}
        </section>
      ) : (
        <ChatTimeline items={view} clockOffset={room.clockOffset} announce={room.announce} onSpoil={room.spoil} />
      )}

      {!session.demo && !isTry && !replay && <FeedbackPrompt guestId={session.guestId} guestKey={session.key ?? ""} roomCode={session.code} />}
      {!soundOn && !muted && room.ready && (
        <button onClick={unlockSound} className="mx-auto mb-1 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted">
          {t.roar.soundOn}
        </button>
      )}
      {lagHint && lagHint.moments > calDismissedAt && (
        <CalibrationCard
          s={lagHint}
          onApply={() => {
            setSource("crowd");
            room.setLag(lagHint.lag, "crowd");
          }}
          onDismiss={() => setCalDismissedAt(lagHint.moments)}
        />
      )}
      {showWavePill && (
        <div className="mx-auto mb-1 flex max-w-xl items-center gap-1 px-3">
          <button
            onClick={() => (setWaveOpen(true), setWaveSeen(latestMoment.id))}
            className="pop-in min-w-0 flex-1 truncate rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent"
          >
            {t.wave.pill(new Set([...waveMembers.map((m) => m.senderId), ...latestMoment.reactors.map((r) => r.senderId)]).size)}
          </button>
          <button onClick={() => setWaveSeen(latestMoment.id)} aria-label={t.wave.dismiss} className="rounded-full px-2 py-1 text-muted">
            ✕
          </button>
        </div>
      )}
      {suspense && !(replay && (!synced || room.paused)) && <HypeStrip pending={pending} clockOffset={room.clockOffset} />}
      <Composer disabled={!canChat} onSend={room.sendText} chips={QUICK_CHIPS[sport]}>
        <RoarButton disabled={!canChat} onStart={() => !soundOn && !muted && unlockSound()} onRoar={(i, d) => room.sendRoar(i, d).catch(() => undefined)} />
      </Composer>

      {/* Floodlight glow while the crowd roars. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 transition-opacity duration-700"
        style={{ opacity: glow, boxShadow: "inset 0 0 90px 18px rgba(198,255,61,0.45), inset 0 0 220px 40px rgba(255,255,255,0.12)" }}
      />

      <LagSheet
        open={lagOpen}
        onClose={() => setLagOpen(false)}
        lagMs={room.lagMs}
        source={source}
        onChange={(ms, src) => {
          setSource(src);
          room.setLag(ms, src);
        }}
      />

      <Sheet open={menuOpen} onClose={() => (setMenuOpen(false), setConfirmAll(false))} title={t.room.menu}>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => (setMenuOpen(false), setInviteOpen(true))}
            className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left"
          >
            {t.room.invite}
          </button>
          {FEATURES.wave && room.moments.length > 0 && (
            <button onClick={() => (setMenuOpen(false), setWaveOpen(true))} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.wave.menu} ({room.moments.length})
            </button>
          )}
          {FEATURES.ghostCrowd && !isTry && !replay && (
            <Link href={`/r/${session.code}?replay=1`} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.ghost.menu}
            </Link>
          )}
          {!replay && (
            <button
              onClick={() => (setMenuOpen(false), setSyncOpen(true))}
              disabled={!room.ready}
              className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left disabled:opacity-50"
            >
              {t.sync.menu}
            </button>
          )}
          {confirmAll ? (
            <div className="rounded-2xl border border-danger/60 bg-danger/10 p-3 text-sm">
              <p>{t.room.revealAllConfirm}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => (room.spoilAll(), setMenuOpen(false), setConfirmAll(false))}
                  className="rounded-full bg-danger px-4 py-2 font-semibold text-black"
                >
                  {t.room.revealAll}
                </button>
                <button onClick={() => setConfirmAll(false)} className="rounded-full border border-line px-4 py-2">
                  {t.room.spoilCancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAll(true)}
              disabled={room.lockedCount === 0}
              className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left disabled:opacity-50"
            >
              {t.room.revealAll} {room.lockedCount > 0 && `(${room.lockedCount})`}
            </button>
          )}
          <Toggle
            label={t.hype.suspense}
            help={t.hype.suspenseHelp}
            on={suspense}
            onChange={(v) => (setSuspense(v), saveSetting("suspense", v))}
          />
          <Toggle
            label={t.roar.sound}
            help={t.roar.soundHelp}
            on={!muted}
            onChange={(v) => {
              setMuted(!v);
              saveSetting("muted", !v);
              crowd.current?.setMuted(!v);
              if (v) unlockSound();
            }}
          />
        </div>
      </Sheet>

      {FEATURES.wave && (
        <WaveSheet open={waveOpen} onClose={() => setWaveOpen(false)} moments={room.moments} members={waveMembers} roomName={roomName} code={session.code} />
      )}

      <SyncStartSheet open={syncOpen} onClose={() => setSyncOpen(false)} onStart={room.startSyncCheck} />

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t.empty.title}>
        <div className="mt-4">{origin && <InvitePanel url={inviteUrl} roomName={roomName} />}</div>
      </Sheet>
    </div>
  );
}
