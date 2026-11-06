import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { DeleteMyData } from "./DeleteMyData";

export const metadata: Metadata = { title: t.privacy.title };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Link href="/" className="text-sm text-muted">
        ← {t.appName}
      </Link>
      <h1 className="mt-4 font-display text-5xl">{t.privacy.title}</h1>
      <p className="mt-3 text-muted">{t.privacy.intro}</p>
      <ul className="mt-5 list-disc space-y-2 pl-5">
        {t.privacy.stored.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="mt-5 text-muted">{t.privacy.chat}</p>
      <section className="mt-8 rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-display text-3xl">{t.privacy.deleteTitle}</h2>
        <p className="mt-2 text-sm text-muted">{t.privacy.deleteBody}</p>
        <DeleteMyData />
      </section>
    </main>
  );
}
