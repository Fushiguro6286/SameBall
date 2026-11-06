import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-5xl">404</h1>
      <p className="max-w-xs text-muted">{t.room.notFound}</p>
      <Link href="/" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">
        {t.landing.createRoom}
      </Link>
    </main>
  );
}
