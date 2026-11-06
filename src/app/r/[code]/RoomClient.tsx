"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalibrationCard } from "@/components/CalibrationCard";
import { CatchupSheet } from "@/components/CatchupSheet";
import { ChatTimeline } from "@/components/ChatTimeline";
import { Composer } from "@/components/Composer";
import { ConnBanner } from "@/components/ConnBanner";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { GhostPanel } from "@/components/GhostPanel";
import { HypeStrip } from "@/components/HypeStrip";
import { LagBoard, useWatching } from "@/components/LagBoard";
import { LangToggle } from "@/components/Lang";
import { RoarButton } from "@/components/RoarButton";
import { StartBanner } from "@/components/StartBanner";
import { CallCard, CallStartSheet } from "@/components/CallIt";
import { LeagueSheet } from "@/components/League";
import { HuddleSheet } from "@/components/Huddle";
import { MomentCard } from "@/components/MomentCard";
import { NexconnBadge } from "@/components/NexconnBadge";
import { PauseBar } from "@/components/PauseBar";
import { RecapSheet } from "@/components/Recap";
import { AloneCard, PrematchChecklist, TryDemoLink } from "@/components/RoomCards";
import { SyncCheckCard, SyncStartSheet } from "@/components/SyncCheck";
import { Toggle } from "@/components/Toggle";
import { TryPanel } from "@/components/TryPanel";
import { VoiceButton } from "@/components/VoiceButton";
import { WaveSheet } from "@/components/WaveSheet";
import { Crowd } from "@/lib/audio/crowd";
import { InvitePanel } from "@/components/InvitePanel";
import { LagSheet } from "@/components/LagSheet";
import { ProfileFields } from "@/components/ProfileFields";
import { Sheet } from "@/components/Sheet";
import { errorText, moderateApi, startSession } from "@/lib/client/api";
import { setMetricsUser, track } from "@/lib/client/metrics";
import { loadBlocked, loadProfile, loadRoomPrefs, loadRoomStr, loadSetting, loadStand, rememberRoom, saveBlocked, saveProfile, saveRoomStr, saveSetting, saveStand } from "@/lib/client/storage";
import { AVATARS, CHIP_PACKS, END_LABELS, FEATURES, SLOW_MODES, LAG_SOURCES, asChipPack, asSport, chipsFor, type Sport, STADIUM_STANDS, type StandId } from "@/lib/config";
import { useNow } from "@/lib/client/useNow";
import { useT } from "@/lib/i18n/client";
import { useRoom, type RoomSession } from "@/lib/room/useRoom";
import { suggestSync } from "@/lib/timing/autosync";
import { reachedAllAt } from "@/lib/timing/wave";
import { TRY_BOTS } from "@/lib/try-script";
import { isProfane, maskProfanity } from "@/lib/profanity";
import type { ViewItem } from "@/lib/timing/room-store";

const DEFAULT_SOURCE = LAG_SOURCES.find((s) => s.id === "streaming")!;
const TV_SOURCE = LAG_SOURCES.find((s) => s.id === "tv")!;
const REPLAY_AHEAD_MS = 30_000;
const WAVE_FRESH_MS = 3 * 60_000;
/** A moment card pops up only if the moment reached everyone this recently (old history stays quiet). */
const CARD_FRESH_MS = 5 * 60_000;

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
  aiCatchup = false,
  demo,
}: {
  code: string;
  roomName: string;
  sport: string;
  kind?: string;
  startsAt?: number;
  ownerId?: string;
  /** The server has an AI provider configured. */
  aiCatchup?: boolean;
  demo: boolean;
}) {
  const t = useT();
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
      if (ref && !second) track("invite_opened", room.code);
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
        stand: kind === "stadium" ? loadStand(room.code, res.guestId) : undefined,
        hostId: kind === "creator" && FEATURES.creatorRooms ? ownerId : undefined,
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
        key={`${replay ? "replay" : "live"}-${session.stand ?? ""}`}
        session={session}
        onStand={
          session.stand
            ? (s) => {
                saveStand(session.code, s);
                setSession({ ...session, stand: s });
              }
            : undefined
        }
        roomName={currentName}
        sport={asSport(sport)}
        isTry={kind === "try"}
        second={second}
        replay={replay}
        catchup={FEATURES.aiCatchup && aiCatchup}
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
  catchup,
  startsAt,
  ownerId,
  notice,
  onStand,
}: {
  session: RoomSession;
  roomName: string;
  sport: Sport;
  isTry: boolean;
  second: boolean;
  replay: boolean;
  catchup: boolean;
  startsAt?: number;
  ownerId?: string;
  notice: string | null;
  /** Stadiums only: move to another stand (sub-channel). */
  onStand?: (s: StandId) => void;
}) {
  const t = useT();
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
  /** Judge Mode starts the over a few seconds after the feed is picked. */
  const [lagDone, setLagDone] = useState(!(prefs.first && !replay));
  const [checklist, setChecklist] = useState(() => !isTry && !replay && !second && !loadSetting("prematchDone", false));
  const [aloneHidden, setAloneHidden] = useState(false);
  /** "I paused my stream": when, and the delay/feed to return to with "Back to live". */
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapSeen, setRecapSeen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pausedFrom, setPausedFrom] = useState<{ at: number; lag: number; source: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [waveOpen, setWaveOpen] = useState(false);
  const [catchupOpen, setCatchupOpen] = useState(false);
  const [waveSeen, setWaveSeen] = useState<string | null>(null);
  const [cardSeen, setCardSeen] = useState<string | null>(null);
  const [hostTarget, setHostTarget] = useState<ViewItem | null>(null);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [hostNote, setHostNote] = useState<string | null>(null);
  /** Observation count when the auto-sync hint was dismissed; it returns only after new evidence. */
  const [calDismissedAt, setCalDismissedAt] = useState(0);
  const [origin, setOrigin] = useState("");
  /** Couch mode: the friend whose screen I share; I follow their delay changes. */
  const [couchWith, setCouchWith] = useState(() => (FEATURES.couchMode ? loadRoomStr("couch", session.code) : null));
  const linkCouch = (id: string | null) => {
    setCouchWith(id);
    saveRoomStr("couch", session.code, id);
  };
  const [pack, setPack] = useState(() => (FEATURES.regionalChips ? asChipPack(loadRoomStr("chips", session.code)) : null));

  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is browser-only
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/r/${session.code}${session.demo ? "?demo=1" : `?ref=${session.guestId}`}`;

  // Tab title shows counts only, never content.
  useEffect(() => {
    const counts = t.room.titleCounts(room.unseen, room.lockedCount);
    document.title = counts ? `(${counts}) ${roomName}` : roomName;
  }, [room.unseen, room.lockedCount, roomName, t]);

  const watching = useWatching(session.guestId, session.key ?? "", session.code, !replay && !session.demo && !!session.key);
  // My own entry always shows my current lag, even before my latest stamp goes out.
  const boardEntries = [
    ...room.lags.filter((l) => l.senderId !== session.guestId),
    { senderId: session.guestId, name: session.name, avatar: session.avatar, lag: room.lagMs },
  ];
  const lagS = Math.round(room.lagMs / 1000);
  const couchLag = couchWith && !replay ? room.lags.find((l) => l.senderId === couchWith)?.lag : undefined;
  useEffect(() => {
    if (couchLag === undefined || room.paused || Math.abs(couchLag - room.lagMs) < 500) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the friend's new delay
    setSource("couch");
    room.setLag(couchLag, "couch");
    // Only their changes should move me; my own lag is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couchLag, room.paused]);
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
  // Once I've applied a suggestion (source "crowd"), only real drift brings it back.
  const lagHint = FEATURES.autoCalibration && !replay && !room.paused ? suggestSync(room.syncObs, room.lagMs, source === "crowd") : null;
  const lastMoment = FEATURES.momentCards && !replay && !isTry ? room.moments.at(-1) : undefined;
  const cardNow = useNow(!!lastMoment && lastMoment.id !== cardSeen, 5000, room.clockOffset);
  const cardAt = lastMoment ? reachedAllAt(lastMoment, boardEntries) : Infinity;
  const cardMoment = lastMoment && lastMoment.id !== cardSeen && cardNow >= cardAt && cardNow - cardAt < CARD_FRESH_MS ? lastMoment : undefined;
  const showWavePill =
    !!latestMoment && latestMoment.id !== waveSeen && latestMoment.id !== cardMoment?.id && waveNow - (latestMoment.matchTime + room.lagMs) < WAVE_FRESH_MS;
  const canChat = room.ready && (!replay || synced);
  const others = boardEntries.filter((e) => e.senderId !== session.guestId && !e.senderId.startsWith("bot_")).length;
  const alone = !isTry && !replay && room.ready && others === 0 && (watching ?? 1) <= 1;
  const isOwner = !!ownerId && ownerId === session.guestId;
  // Creator room: one host, many fans, each on their own delay.
  const creator = !!session.hostId;
  const isHost = creator && isOwner;
  const host = room.host;
  // Fans' words are masked on screen; the host's commentary is shown as written.
  if (creator) view = view.map((v) => (v.text && v.kind === "text" && v.senderId !== session.hostId ? { ...v, text: maskProfanity(v.text) } : v));
  const pinned = host?.pinId ? view.find((v) => v.id === host.pinId && !v.locked) : undefined;
  const fanQuiet = creator && !isHost && !!host?.quiet;
  const endLabel = END_LABELS[sport];
  const canRecap = !isTry && !replay && !session.demo;
  // The end-of-match anchor opens the recap offer only once it has reached *my* screen.
  const matchOver = canRecap && view.some((v) => v.kind === "anchor" && !v.locked && v.text === endLabel && (v.senderId === ownerId || v.senderId.startsWith("bot_")));

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
              demoFriends={isTry ? Object.keys(TRY_BOTS).length : 0}
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
            {couchLag !== undefined ? "🛋️" : "⏱"} {t.room.lagBadge(lagS)}
          </button>
        )}
        <button onClick={() => setMenuOpen(true)} aria-label={t.room.menu} className="rounded-full px-2 py-1 text-xl">
          ⋯
        </button>
      </header>

      {creator && (
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5 text-xs">
          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-ink">{t.creator.badge}</span>
          <span className="min-w-0 flex-1 truncate text-muted">{isHost ? t.creator.youHost : t.creator.fanHelp}</span>
          {!!host?.slowS && <span className="shrink-0 text-muted">🐢 {t.creator.slowOn(host.slowS)}</span>}
        </div>
      )}
      {FEATURES.scoreStrip && room.score && (
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5 text-sm" title={t.score.help}>
          <span className="shrink-0 text-xs text-muted">📺 {t.score.label}</span>
          <p aria-live="polite" className="min-w-0 flex-1 truncate text-right font-semibold tabular-nums">
            {room.score}
          </p>
        </div>
      )}
      {pinned && (
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-sm">
          <span aria-hidden>📌</span>
          <p className="min-w-0 flex-1 truncate">
            <span className="text-muted">{pinned.senderName}: </span>
            {pinned.voice ? "🎙️" : pinned.text}
          </p>
          {isHost && (
            <button onClick={() => room.hostOp("pin", { id: "" }).catch(() => undefined)} aria-label={t.creator.unpin} className="rounded-full px-2 text-muted">
              ✕
            </button>
          )}
        </div>
      )}
      {fanQuiet && (
        <p role="status" className="border-b border-line bg-surface-2 px-3 py-2 text-center text-sm">
          🤫 {t.creator.quietFan}
        </p>
      )}

      {onStand && (
        <nav aria-label={t.stadium.stands} className="flex items-center gap-2 overflow-x-auto border-b border-line px-3 py-2 text-sm">
          <span className="shrink-0 text-muted">{t.stadium.badge}</span>
          {STADIUM_STANDS.map((s) => (
            <button
              key={s}
              onClick={() => s !== session.stand && onStand(s)}
              aria-pressed={s === session.stand}
              className={`shrink-0 rounded-full px-3 py-1 ${s === session.stand ? "bg-accent font-semibold text-accent-ink" : "border border-line"}`}
            >
              {t.stadium.names[s]}
            </button>
          ))}
        </nav>
      )}

      {notice && (
        <p role="status" className="bg-surface-2 px-4 py-2 text-center text-sm">
          {notice}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,auto)_minmax(0,1fr)_auto]">
      {/* Laptops: match strip and cards on the left, chat on the right. Phones: one column, cards above the chat. */}
      <div className="contents lg:col-start-1 lg:row-start-1 lg:block lg:overflow-y-auto lg:border-r lg:border-line">
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
          autoStart={lagDone}
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

      {pausedFrom && !replay && (
        <PauseBar
          since={pausedFrom.at}
          onBack={() => (room.resumeAt(null, "custom"), setSource("custom"), setPausedFrom(null))}
          onLive={() => {
            const preset = LAG_SOURCES.find((s) => s.id === pausedFrom.source);
            room.resumeAt(preset ? preset.seconds * 1000 : pausedFrom.lag, pausedFrom.source);
            setSource(pausedFrom.source);
            setPausedFrom(null);
          }}
        />
      )}

      {checklist && (
        <PrematchChecklist
          onFeed={() => setLagOpen(true)}
          onInvite={() => setInviteOpen(true)}
          onDone={() => (setChecklist(false), saveSetting("prematchDone", true))}
        />
      )}

      {alone && !empty && !aloneHidden && <AloneCard onInvite={() => setInviteOpen(true)} onDismiss={() => setAloneHidden(true)} />}

      {!replay && (
        <SyncCheckCard
          sync={room.sync}
          myId={session.guestId}
          lagMs={room.lagMs}
          clockOffset={room.clockOffset}
          roomCode={session.code}
          onTap={room.syncTap}
          onApply={(ms) => {
            linkCouch(null);
            setSource("custom");
            room.setLag(ms, "custom");
          }}
        />
      )}

      {FEATURES.callIt && !replay && (
        <CallCard call={room.call} board={room.callBoard} myId={session.guestId} onPick={room.pickCall} onAnswer={room.answerCall} />
      )}

      {cardMoment && <MomentCard moment={cardMoment} members={boardEntries} roomName={roomName} code={session.code} onClose={() => setCardSeen(cardMoment.id)} />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1">
      {empty && !isTry ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="font-display text-4xl">{t.empty.title}</h2>
          <p className="max-w-xs text-muted">{t.empty.body}</p>
          {origin && <InvitePanel url={inviteUrl} roomName={roomName} />}
          <TryDemoLink />
        </section>
      ) : (
        <ChatTimeline
          items={view}
          clockOffset={room.clockOffset}
          announce={room.announce}
          onSpoil={room.spoil}
          autoplay={soundOn && !muted}
          hostId={session.hostId}
          onHostAction={isHost ? setHostTarget : undefined}
        />
      )}
      </div>

      <div className="contents lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:flex lg:flex-col lg:justify-end lg:overflow-y-auto lg:border-r lg:border-line lg:pb-2">

      {!session.demo && !isTry && !replay && <FeedbackPrompt guestId={session.guestId} guestKey={session.key ?? ""} roomCode={session.code} />}
      {!soundOn && !muted && room.ready && (
        <button onClick={unlockSound} className="mx-auto mb-1 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted">
          {t.roar.soundOn}
        </button>
      )}
      {lagHint && lagHint.observations > calDismissedAt && (
        <CalibrationCard
          s={lagHint}
          onApply={() => {
            linkCouch(null);
            setSource("crowd");
            room.setLag(lagHint.lag, "crowd");
            track("autosync_applied", session.code, { deltaS: Math.round(lagHint.delta / 1000), drift: lagHint.drift });
          }}
          onDismiss={() => setCalDismissedAt(lagHint.observations)}
        />
      )}
      {matchOver && !recapSeen && (
        <button
          onClick={() => (setRecapOpen(true), setRecapSeen(true))}
          className="pop-in mx-auto mb-1 w-[calc(100%-1.5rem)] max-w-xl truncate rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent"
        >
          {t.recap.over}
        </button>
      )}
      {showWavePill && (
        <div className="mx-auto mb-1 flex w-full max-w-xl items-center gap-1 px-3">
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
      </div>

      <div className="contents lg:col-start-2 lg:row-start-3 lg:block">
      <Composer
        disabled={!canChat || fanQuiet}
        cooldownS={creator && !isHost ? (host?.slowS ?? 0) : 0}
        validate={creator && !isHost ? (v) => (isProfane(v) ? t.creator.blocked : null) : undefined}
        onSend={room.sendText}
        chips={chipsFor(sport, pack)}
        chipsLead={
          FEATURES.regionalChips && (
            <select
              aria-label={t.room.chipPack}
              value={pack ?? ""}
              onChange={(e) => {
                const p = asChipPack(e.target.value);
                setPack(p);
                saveRoomStr("chips", session.code, p);
              }}
              className="shrink-0 rounded-full border border-line bg-surface px-2 py-1.5 text-sm text-muted"
            >
              <option value="">{t.room.chipDefault}</option>
              {Object.entries(CHIP_PACKS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          )
        }
      >
        {FEATURES.voiceNotes && !isTry && <VoiceButton disabled={!canChat} onSend={room.sendVoice} />}
        <RoarButton disabled={!canChat} onStart={() => !soundOn && !muted && unlockSound()} onRoar={(i, d) => room.sendRoar(i, d).catch(() => undefined)} />
      </Composer>
      </div>
      </div>

      {/* Floodlight glow while the crowd roars. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 transition-opacity duration-700"
        style={{ opacity: glow, boxShadow: "inset 0 0 90px 18px rgba(198,255,61,0.45), inset 0 0 220px 40px rgba(255,255,255,0.12)" }}
      />

      <LagSheet
        open={lagOpen}
        onClose={() => (setLagOpen(false), setLagDone(true))}
        lagMs={room.lagMs}
        source={source}
        couch={
          FEATURES.couchMode && !replay && !isTry
            ? { members: boardEntries.filter((e) => e.senderId !== session.guestId && !e.senderId.startsWith("bot_")), linked: couchWith, onLink: linkCouch }
            : undefined
        }
        onPause={
          replay || isTry || pausedFrom
            ? undefined
            : () => {
                linkCouch(null);
                setPausedFrom({ at: Date.now(), lag: room.lagMs, source });
                room.pause();
                track("paused", session.code);
                setLagOpen(false);
              }
        }
        onChange={(ms, src) => {
          linkCouch(null);
          setSource(src);
          room.setLag(ms, src);
        }}
      />

      <Sheet open={menuOpen} onClose={() => (setMenuOpen(false), setConfirmAll(false), setConfirmEnd(false))} title={t.room.menu}>
        <div className="mt-4 flex flex-col gap-2">
          <LangToggle className="self-start" />
          <button
            onClick={() => (setMenuOpen(false), setInviteOpen(true))}
            className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left"
          >
            {t.room.invite}
          </button>
          {isHost && (
            <div className="rounded-2xl border border-line bg-surface-2 p-3 text-sm">
              <p className="font-semibold">🐢 {t.creator.slow}</p>
              <p className="text-xs text-muted">{t.creator.slowHelp}</p>
              <div role="group" aria-label={t.creator.slow} className="mt-2 flex gap-2">
                {SLOW_MODES.map((s) => (
                  <button
                    key={s}
                    aria-pressed={(host?.slowS ?? 0) === s}
                    onClick={() => room.hostOp("slow", { secs: s }).catch(() => undefined)}
                    className="rounded-full border border-line px-3 py-1 aria-pressed:border-accent aria-pressed:bg-accent/15"
                  >
                    {s === 0 ? t.creator.off : `${s}s`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isHost && session.key && (
            <Toggle
              label={`🤫 ${t.creator.quiet}`}
              help={t.creator.quietHelp}
              on={!!host?.quiet}
              onChange={(on) => {
                const auth = { guestId: session.guestId, key: session.key! };
                moderateApi(auth, session.code, session.guestId, on ? "quiet" : "unquiet")
                  .then(() => room.hostOp("quiet", { on }))
                  .catch((e) => setHostNote(errorText(e)));
              }}
            />
          )}
          {hostNote && <p role="alert" className="text-sm text-danger">{hostNote}</p>}
          {FEATURES.callIt && !replay && (!creator || isHost) && (
            <button onClick={() => (setMenuOpen(false), setCallOpen(true))} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.call.menu}
            </button>
          )}
          {FEATURES.huddle && !isTry && !replay && (
            <button onClick={() => (setMenuOpen(false), setHuddleOpen(true))} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.huddle.menu}
            </button>
          )}
          {FEATURES.seriesLeague && FEATURES.callIt && !isTry && !replay && (
            <button onClick={() => (setMenuOpen(false), setLeagueOpen(true))} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.league.menu}
            </button>
          )}
          {catchup && session.key && (
            <button onClick={() => (setMenuOpen(false), setCatchupOpen(true))} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.catchup.menu}
            </button>
          )}
          {canRecap && (
            <button onClick={() => (setMenuOpen(false), setRecapOpen(true), setRecapSeen(true))} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left">
              {t.recap.menu}
            </button>
          )}
          {canRecap && isOwner && !matchOver &&
            (confirmEnd ? (
              <div className="rounded-2xl border border-accent/60 bg-accent/10 p-3 text-sm">
                <p>{t.recap.endConfirm}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => (room.endMatch(endLabel).catch(() => undefined), setConfirmEnd(false), setMenuOpen(false))}
                    className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink"
                  >
                    {t.recap.endYes}
                  </button>
                  <button onClick={() => setConfirmEnd(false)} className="rounded-full border border-line px-4 py-2">
                    {t.room.spoilCancel}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmEnd(true)} disabled={!room.ready} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left disabled:opacity-50">
                {t.recap.end}
              </button>
            ))}
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
          <NexconnBadge className="mt-2 self-start" />
        </div>
      </Sheet>

      {catchup && session.key && (
        <CatchupSheet
          open={catchupOpen}
          onClose={() => setCatchupOpen(false)}
          auth={{ guestId: session.guestId, key: session.key }}
          code={session.code}
          items={view}
          lagMs={room.lagMs}
          lags={boardEntries}
        />
      )}

      {FEATURES.wave && (
        <WaveSheet open={waveOpen} onClose={() => setWaveOpen(false)} moments={room.moments} members={waveMembers} roomName={roomName} code={session.code} />
      )}

      {canRecap && (
        <RecapSheet
          open={recapOpen}
          onClose={() => setRecapOpen(false)}
          code={session.code}
          auth={session.key ? { guestId: session.guestId, key: session.key } : null}
          origin={origin}
          board={room.callBoard}
          moments={FEATURES.wave ? room.moments : []}
          onWave={FEATURES.wave ? () => (setRecapOpen(false), setWaveOpen(true)) : undefined}
        />
      )}

      {isHost && (
        <Sheet open={!!hostTarget} onClose={() => setHostTarget(null)} title={t.creator.actionsTitle}>
          {hostTarget && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="truncate text-sm text-muted">
                {hostTarget.senderName}: {hostTarget.voice ? "🎙️" : hostTarget.text}
              </p>
              {!hostTarget.locked && (
                <button
                  onClick={() => (room.hostOp("pin", { id: hostTarget.id }).catch(() => undefined), setHostTarget(null))}
                  className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left"
                >
                  📌 {t.creator.pin}
                </button>
              )}
              {session.key && (
                <button
                  onClick={() => {
                    const target = hostTarget;
                    setHostTarget(null);
                    moderateApi({ guestId: session.guestId, key: session.key! }, session.code, target.senderId, "recall", { messageId: target.id })
                      // Nexconn deletes it for everyone; the hide op covers clients that don't get the delete event.
                      .then(() => (room.removeMsgs([target.id]), room.hostOp("hide", { id: target.id })))
                      .catch((e) => setHostNote(errorText(e)));
                  }}
                  className="rounded-2xl border border-danger/60 bg-danger/10 px-4 py-3 text-left"
                >
                  🗑 {t.creator.recall}
                </button>
              )}
            </div>
          )}
        </Sheet>
      )}

      {FEATURES.seriesLeague && FEATURES.callIt && !isTry && !replay && (
        <LeagueSheet
          open={leagueOpen}
          onClose={() => setLeagueOpen(false)}
          load={room.loadDeep}
          myId={session.guestId}
          ownerId={ownerId}
          isOwner={isOwner}
          onStartSeries={room.postAnchor}
        />
      )}

      {FEATURES.huddle && (
        <HuddleSheet open={huddleOpen} onClose={() => setHuddleOpen(false)} members={boardEntries} myId={session.guestId} onSync={() => setLagOpen(true)} />
      )}
      <SyncStartSheet open={syncOpen} onClose={() => setSyncOpen(false)} onStart={room.startSyncCheck} />
      {FEATURES.callIt && <CallStartSheet open={callOpen} onClose={() => setCallOpen(false)} sport={sport} onStart={room.startCall} />}

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t.empty.title}>
        <div className="mt-4">{origin && <InvitePanel url={inviteUrl} roomName={roomName} />}</div>
      </Sheet>
    </div>
  );
}
