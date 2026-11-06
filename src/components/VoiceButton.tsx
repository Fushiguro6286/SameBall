"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { VOICE_MAX_S } from "@/lib/transport/wire";

const MIN_MS = 600;
/** Released after this long = hold-to-record; a quicker tap keeps recording until the next tap. */
const HOLD_MS = 500;

type Rec = { mr: MediaRecorder; stream: MediaStream; startedAt: number; send: boolean };

const pickType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));

/** Voice note: hold to record (or tap to start, tap again to send), max 15 s. */
export function VoiceButton({ disabled, onSend }: { disabled: boolean; onSend: (file: File, durS: number) => Promise<void> }) {
  const t = useT();
  const rec = useRef<Rec | null>(null);
  const pressAt = useRef(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"" | "sending" | "denied" | "failed" | "unsupported">("");

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const r = rec.current;
      if (!r) return;
      const ms = Date.now() - r.startedAt;
      setElapsed(ms);
      if (ms >= VOICE_MAX_S * 1000) stop(true);
    }, 200);
    return () => clearInterval(id);
  });
  // Release the microphone if the room closes mid-recording.
  useEffect(() => () => rec.current?.stream.getTracks().forEach((tr) => tr.stop()), []);

  const start = async () => {
    const type = pickType();
    if (!type || !navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
    setStatus("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setStatus("denied");
    }
    const mr = new MediaRecorder(stream, { mimeType: type });
    const chunks: Blob[] = [];
    const r: Rec = { mr, stream, startedAt: Date.now(), send: false };
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const ms = Math.min(VOICE_MAX_S * 1000, Date.now() - r.startedAt);
      if (!r.send || ms < MIN_MS) return;
      setStatus("sending");
      try {
        const ext = type.includes("mp4") ? "m4a" : "webm";
        await onSend(new File(chunks, `voice.${ext}`, { type: type.split(";")[0] }), Math.max(1, Math.round(ms / 1000)));
        setStatus("");
      } catch {
        setStatus("failed");
      }
    };
    mr.start();
    rec.current = r;
    setElapsed(0);
    setRecording(true);
  };

  function stop(send: boolean) {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    r.send = send;
    if (r.mr.state !== "inactive") r.mr.stop();
    setRecording(false);
  }

  const secs = Math.floor(elapsed / 1000);
  return (
    <div className="relative flex items-center">
      {recording && (
        <button type="button" onClick={() => stop(false)} aria-label={t.voice.cancel} className="mr-1 rounded-full px-2 text-muted">
          ✕
        </button>
      )}
      <button
        type="button"
        disabled={disabled || status === "sending"}
        aria-label={recording ? t.voice.recording(secs) : t.voice.record}
        aria-pressed={recording}
        onPointerDown={(e) => {
          if (e.button !== 0 || recording) return;
          pressAt.current = Date.now();
          start();
        }}
        onPointerUp={() => {
          // Hold-to-record: release sends. A quick tap leaves it recording until tapped again.
          if (recording && Date.now() - pressAt.current > HOLD_MS) stop(true);
          else if (recording && pressAt.current === 0) stop(true);
          pressAt.current = 0;
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          if (recording) stop(true);
          else start();
        }}
        className={`grid h-12 min-w-12 place-items-center rounded-full border px-2 text-xl tabular-nums disabled:opacity-40 ${recording ? "border-danger bg-danger/20 text-sm font-semibold text-danger" : "border-line bg-surface-2"}`}
      >
        {recording ? `● ${secs}s` : status === "sending" ? "…" : "🎙️"}
      </button>
      {status && status !== "sending" && (
        <p role="alert" className="absolute bottom-full right-0 mb-2 w-56 rounded-xl bg-danger/15 px-3 py-2 text-xs">
          {t.voice[status]}
        </p>
      )}
    </div>
  );
}

/** A revealed voice note. Auto-plays once when it reaches my screen, if I allowed sound. */
export function VoiceNote({ url, dur, label, autoplay }: { url: string; dur: number; label: string; autoplay: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (autoplay) ref.current?.play().catch(() => undefined);
  }, [autoplay]);
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden>🎙️</span>
      <audio ref={ref} src={url} controls preload="metadata" aria-label={label} className="h-9 max-w-56" />
      <span className="text-xs tabular-nums text-muted">{dur}s</span>
    </div>
  );
}
