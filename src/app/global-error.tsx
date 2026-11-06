"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/client/report-error";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="en">
      <body style={{ background: "#070b18", color: "#f4f6fb", fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Something broke.</h1>
          <button onClick={reset} style={{ background: "#c6ff3d", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600 }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
