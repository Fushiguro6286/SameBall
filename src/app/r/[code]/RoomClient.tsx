"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatTimeline } from "@/components/ChatTimeline";
import { Composer } from "@/components/Composer";
import { ConnBanner } from "@/components/ConnBanner";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { InvitePanel } from "@/components/InvitePanel";
import { LagSheet } from "@/components/LagSheet";
import { ProfileFields } from "@/components/ProfileFields";
import { Sheet } from "@/components/Sheet";
import { errorText, startSession } from "@/lib/client/api";
import { setMetricsUser, track } from "@/lib/client/metrics";
import { loadProfile, loadRoomPrefs, rememberRoom, saveProfile } from "@/lib/client/storage";
import { AVATARS, LAG_SOURCES } from "@/lib/config";
import { t } from "@/lib/i18n";
import { useRoom, type RoomSession } from "@/lib/room/useRoom";

const DEFAULT_SOURCE = LAG_SOURCES.find((s) => s.id === "streaming")!;

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

export function RoomClient({ code, roomName, demo }: { code: string; roomName: string; demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
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
        guestId: prev?.guestId,
        name: n,
        avatar: a as (typeof AVATARS)[number],
        roomCode: code,
        ref: ref && /^g_[A-Za-z0-9]{20}$/.test(ref) ? ref : undefined,
      });
      saveProfile({ guestId: res.guestId, name: n, avatar: a });
      setMetricsUser(res.guestId);
      const room = res.room!;
      rememberRoom({ code: room.code, name: room.name });
      setCurrentName(room.name);
      track("joined", room.code);
      if (room.redirectedFrom) {
        setNotice(t.join.redirected(room.name));
        router.replace(`/r/${room.code}`);
      }
      setSession({ code: room.code, channelId: room.channelId, guestId: res.guestId, name: n, avatar: a, demo: false, token: res.token, appKey: res.appKey, area: res.area });
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
    const p = loadProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only storage
    if (p?.name) setName(p.name);
    if (p?.avatar) setAvatar(p.avatar);
    if (p?.name && p.avatar && (demo || p.guestId)) join(p.name, p.avatar);
    else setPhase("join");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "room" && session) return <RoomView session={session} roomName={currentName} notice={notice} />;

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

function RoomView({ session, roomName, notice }: { session: RoomSession; roomName: string; notice: string | null }) {
  const params = useSearchParams();
  const [prefs] = useState(() => {
    const saved = loadRoomPrefs(session.code);
    const devLag = session.demo ? Number(params.get("lag")) : NaN; // ?lag=25 (seconds), demo only
    if (Number.isFinite(devLag) && params.get("lag") !== null) return { lagMs: devLag * 1000, source: "custom", first: false };
    return saved ? { ...saved, first: false } : { lagMs: DEFAULT_SOURCE.seconds * 1000, source: DEFAULT_SOURCE.id as string, first: true };
  });
  const room = useRoom(session, prefs.lagMs, prefs.source);
  const [source, setSource] = useState(prefs.source);
  const [lagOpen, setLagOpen] = useState(prefs.first);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [origin, setOrigin] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is browser-only
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/r/${session.code}${session.demo ? "?demo=1" : `?ref=${session.guestId}`}`;

  // Tab title shows counts only, never content.
  useEffect(() => {
    const counts = t.room.titleCounts(room.unseen, room.lockedCount);
    document.title = counts ? `(${counts}) ${roomName}` : roomName;
  }, [room.unseen, room.lockedCount, roomName]);

  const lagS = Math.round(room.lagMs / 1000);
  const empty = room.ready && room.view.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      <ConnBanner status={room.status} isDemo={room.isDemo} onRetry={room.retry} />
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Link href="/" aria-label={t.room.leaveHome} className="rounded-full px-2 py-1 text-xl text-muted">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl leading-tight">{roomName}</h1>
        <button
          onClick={() => setLagOpen(true)}
          aria-label={`${t.room.lagButtonLabel}: ${t.room.lagBadge(lagS)}`}
          className="rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent"
        >
          ⏱ {t.room.lagBadge(lagS)}
        </button>
        <button onClick={() => setMenuOpen(true)} aria-label={t.room.menu} className="rounded-full px-2 py-1 text-xl">
          ⋯
        </button>
      </header>

      {notice && (
        <p role="status" className="bg-surface-2 px-4 py-2 text-center text-sm">
          {notice}
        </p>
      )}

      {empty ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="font-display text-4xl">{t.empty.title}</h2>
          <p className="max-w-xs text-muted">{t.empty.body}</p>
          {origin && <InvitePanel url={inviteUrl} roomName={roomName} />}
        </section>
      ) : (
        <ChatTimeline items={room.view} clockOffset={room.clockOffset} announce={room.announce} onSpoil={room.spoil} />
      )}

      {!session.demo && <FeedbackPrompt guestId={session.guestId} roomCode={session.code} />}
      <Composer disabled={!room.ready} onSend={room.sendText} />

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
        </div>
      </Sheet>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t.empty.title}>
        <div className="mt-4">{origin && <InvitePanel url={inviteUrl} roomName={roomName} />}</div>
      </Sheet>
    </div>
  );
}
