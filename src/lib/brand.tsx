// Brand art rendered with next/og (Satori). No logos of teams, leagues or broadcasters.

export const NAVY = "#070b18";
export const LIME = "#c6ff3d";

/** App mark: a lime ball with two offset rings (two feeds, one moment). */
export function Mark({ size }: { size: number }) {
  const r = size * 0.28;
  return (
    <div style={{ width: size, height: size, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r * 1.45} fill="none" stroke={LIME} strokeOpacity="0.35" strokeWidth={size * 0.035} />
        <circle cx={size / 2} cy={size / 2} r={r * 1.18} fill="none" stroke={LIME} strokeOpacity="0.6" strokeWidth={size * 0.035} />
        <circle cx={size / 2} cy={size / 2} r={r} fill={LIME} />
        <path
          d={`M ${size / 2 - r * 0.55} ${size / 2 - r * 0.8} Q ${size / 2 - r * 0.15} ${size / 2} ${size / 2 - r * 0.55} ${size / 2 + r * 0.8}`}
          fill="none"
          stroke={NAVY}
          strokeWidth={size * 0.03}
        />
        <path
          d={`M ${size / 2 + r * 0.55} ${size / 2 - r * 0.8} Q ${size / 2 + r * 0.15} ${size / 2} ${size / 2 + r * 0.55} ${size / 2 + r * 0.8}`}
          fill="none"
          stroke={NAVY}
          strokeWidth={size * 0.03}
        />
      </svg>
    </div>
  );
}

export function OgCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: `radial-gradient(circle at 15% 0%, rgba(198,255,61,0.22), ${NAVY} 55%)`,
        color: "#f4f6fb",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Mark size={96} />
        <div style={{ fontSize: 44, color: LIME, fontWeight: 700, letterSpacing: 2 }}>SameBall</div>
      </div>
      <div style={{ fontSize: 72, fontWeight: 800, marginTop: 40, lineHeight: 1.05 }}>{title}</div>
      <div style={{ fontSize: 34, marginTop: 24, color: "#a3acc6" }}>{subtitle}</div>
    </div>
  );
}

export interface RecapArtData {
  name: string;
  fans: number;
  spoilers: number;
  roars: number;
  spreadS: number | null;
  topRoarer: { name: string; avatar: string; roars: number } | null;
}

/** Squad recap card: counts and names only, never messages. `tall` = 1080×1920 story, else 1200×630 link preview. */
export function RecapArt({ r, tall }: { r: RecapArtData; tall?: boolean }) {
  const k = tall ? 1.6 : 1;
  const stats: [string, string][] = [
    ["Spoilers held", String(r.spoilers)],
    ["Fans", String(r.fans)],
    ["Roars", String(r.roars)],
    ["Biggest gap", r.spreadS === null ? "–" : `${r.spreadS}s`],
  ];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: tall ? "center" : "flex-start",
        padding: tall ? 100 : 64,
        background: `radial-gradient(circle at 15% 0%, rgba(198,255,61,0.22), ${NAVY} 55%)`,
        color: "#f4f6fb",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Mark size={72 * k} />
        <div style={{ fontSize: 36 * k, color: LIME, fontWeight: 700, letterSpacing: 2 }}>SameBall · Squad recap</div>
      </div>
      <div style={{ fontSize: 58 * k, fontWeight: 800, marginTop: 28 * k, lineHeight: 1.05, display: "flex" }}>{r.name.slice(0, 60)}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 * k, marginTop: 36 * k }}>
        {stats.map(([label, value]) => (
          <div
            key={label}
            style={{ display: "flex", flexDirection: "column", width: tall ? 400 : 250, padding: 20 * k, borderRadius: 24, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.12)" }}
          >
            <div style={{ fontSize: 26 * k, color: "#a3acc6" }}>{label}</div>
            <div style={{ fontSize: 64 * k, fontWeight: 800, color: LIME }}>{value}</div>
          </div>
        ))}
      </div>
      {r.topRoarer && (
        <div style={{ fontSize: 30 * k, marginTop: 30 * k, display: "flex" }}>
          {`📣 Loudest roar: ${r.topRoarer.name} (${r.topRoarer.roars})`}
        </div>
      )}
      <div style={{ fontSize: 28 * k, marginTop: 24 * k, color: "#a3acc6", display: "flex" }}>Every message waited for each screen. Join us for the next match.</div>
    </div>
  );
}
