"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

// A looping 9-second story: the fast phone sees the six and a friend's message;
// the slow phone gets a locked bubble that unlocks the moment its own feed shows the six.
const LOOP = 9000;
const SIX_FAST = 1500;
const MSG = 2200;
const HERO_LAG = 4000;

export function HeroPhones() {
  const t = useT();
  const [ms, setMs] = useState(LOOP - 1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const id = setInterval(() => setMs((performance.now() - start) % LOOP), 200);
    return () => clearInterval(id);
  }, []);

  const fastSix = ms >= SIX_FAST;
  const slowSix = ms >= SIX_FAST + HERO_LAG;
  const msgShown = ms >= MSG;
  const unlocked = ms >= MSG + HERO_LAG;
  const secsLeft = Math.max(0, Math.ceil((MSG + HERO_LAG - ms) / 1000));

  return (
    <div aria-hidden className="mx-auto flex w-full max-w-md justify-center gap-4 sm:gap-6">
      <Phone label={t.landing.phoneFast} six={fastSix}>
        {msgShown && <Mine />}
      </Phone>
      <Phone label={t.landing.phoneSlow} six={slowSix}>
        {msgShown &&
          (unlocked ? (
            <Theirs flash={ms < MSG + HERO_LAG + 1200} />
          ) : (
            <div className="frost relative h-9 w-full overflow-hidden rounded-xl rounded-bl-sm border border-line">
              <span className="frost-glass absolute inset-0 flex items-center justify-between px-2 text-[10px]">
                🔒 <span>{`${t.landing.heroUnlocks} ${secsLeft}s`}</span>
              </span>
            </div>
          ))}
      </Phone>
    </div>
  );
}

function Phone({ label, six, children }: { label: string; six: boolean; children: React.ReactNode }) {
  return (
    <div className="w-40 rounded-[2rem] border-2 border-line bg-surface p-2 shadow-[0_0_60px_-20px_rgba(198,255,61,0.35)] sm:w-44">
      <div className="rounded-[1.5rem] bg-background p-2.5">
        <div className="text-[10px] text-muted">{label}</div>
        <div className={`mt-2 rounded-xl border border-line px-2 py-2 text-center transition-colors duration-500 ${six ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>
          <div className="text-[9px] uppercase tracking-wider opacity-80">Thunder XI</div>
          <div className="font-display text-2xl leading-none">{six ? "148/3" : "142/3"}</div>
          <div className="text-[10px] font-semibold">{six ? "SIX!" : "18.4 ov"}</div>
        </div>
        <div className="mt-3 flex h-12 items-end">{children}</div>
      </div>
    </div>
  );
}

function Mine() {
  const t = useT();
  return <p className="pop-in ml-auto rounded-xl rounded-br-sm bg-accent px-2 py-1.5 text-xs text-accent-ink">{t.landing.heroMsg}</p>;
}
function Theirs({ flash }: { flash: boolean }) {
  const t = useT();
  return (
  <p className={`rounded-xl rounded-bl-sm border border-line bg-surface-2 px-2 py-1.5 text-xs ${flash ? "reveal-flash" : ""}`}>🦊 {t.landing.heroMsg}</p>
  );
}
