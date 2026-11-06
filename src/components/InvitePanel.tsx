"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export function InvitePanel({ url, roomName }: { url: string; roomName: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.empty.copy, url);
    }
  };

  const toggleQr = async () => {
    if (qr) return setQr(null);
    const { toDataURL } = await import("qrcode");
    setQr(await toDataURL(url, { margin: 1, width: 240, color: { dark: "#070b18", light: "#ffffff" } }));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {canShare && (
          <button
            onClick={() => navigator.share({ title: roomName, text: t.empty.shareText(roomName), url }).catch(() => undefined)}
            className="rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink"
          >
            {t.empty.share}
          </button>
        )}
        <button onClick={copy} className="rounded-full border border-line bg-surface-2 px-4 py-2.5">
          <span aria-live="polite">{copied ? t.empty.copied : t.empty.copy}</span>
        </button>
        <button onClick={toggleQr} aria-expanded={!!qr} className="rounded-full border border-line bg-surface-2 px-4 py-2.5">
          {qr ? t.empty.hideQr : t.empty.qr}
        </button>
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR code for ${url}`} width={200} height={200} className="rounded-xl" />
      )}
      <p className="break-all text-center text-xs text-muted">{url}</p>
    </div>
  );
}
