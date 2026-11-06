import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = { title: t.admin.title, robots: { index: false } };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="font-display text-5xl">{t.admin.title}</h1>
      <AdminPanel />
    </main>
  );
}
