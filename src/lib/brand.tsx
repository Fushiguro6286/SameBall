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
