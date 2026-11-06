import Link from "next/link";
import { Suspense } from "react";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { FeaturedRooms } from "@/components/FeaturedRooms";
import { HeroPhones } from "@/components/HeroPhones";
import { MyRooms } from "@/components/MyRooms";
import { t } from "@/lib/i18n";

export default function Home() {
  return (
    <main className="floodlight flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-10 px-4 pb-16 pt-10">
        <header className="text-center">
          <p className="font-display text-xl tracking-widest text-accent">{t.appName}</p>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] sm:text-6xl">{t.landing.heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-md text-muted">{t.landing.heroBody}</p>
        </header>

        <HeroPhones />

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/try" className="rounded-full bg-accent px-7 py-3.5 text-lg font-semibold text-accent-ink">
            {t.landing.tryIt}
          </Link>
          <a href="#create" className="rounded-full border border-accent/60 px-7 py-3.5 text-lg font-semibold text-accent">
            {t.landing.createRoom}
          </a>
        </div>

        <Suspense fallback={null}>
          <FeaturedRooms />
        </Suspense>

        <section aria-labelledby="how" className="w-full">
          <h2 id="how" className="mb-3 font-display text-3xl">
            {t.landing.howTitle}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {t.landing.steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-surface p-4">
                <span className="font-display text-3xl text-accent">{i + 1}</span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <MyRooms />
        <CreateRoomForm />

        <footer className="flex gap-5 text-sm text-muted">
          <Link href="/stats" className="underline-offset-4 hover:underline">
            {t.landing.stats}
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            {t.landing.privacy}
          </Link>
        </footer>
      </div>
    </main>
  );
}
