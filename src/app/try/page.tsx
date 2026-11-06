import type { Metadata } from "next";
import Link from "next/link";
import { Tx } from "@/components/Lang";
import { t } from "@/lib/i18n";
import { TryStart } from "./TryStart";

export const metadata: Metadata = { title: t.try.title, description: t.try.body };

export default function TryPage() {
  return (
    <main className="floodlight flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-3xl border border-line bg-surface p-6">
        <Link href="/" className="text-sm text-muted">
          ← SameBall
        </Link>
        <h1 className="font-display text-5xl leading-[0.95]"><Tx k="try.title" /></h1>
        <p className="text-muted"><Tx k="try.body" /></p>
        <p className="text-sm"><Tx k="try.bots" /></p>
        <TryStart />
        <p className="text-xs text-muted"><Tx k="try.note" /></p>
      </div>
    </main>
  );
}
