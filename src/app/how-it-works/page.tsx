import type { Metadata } from "next";
import Link from "next/link";
import { LangToggle, Tx } from "@/components/Lang";
import { GITHUB_URL } from "@/lib/config";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.how.title, description: t.how.problemBody };

const STEPS = [0, 1, 2, 3] as const;
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const FLOW = [0, 1, 2, 3] as const;

export default function HowItWorks() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">
          ← {t.appName}
        </Link>
        <LangToggle />
      </div>
      <h1 className="mt-4 font-display text-5xl leading-none">
        <Tx k="how.title" />
      </h1>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent">
        <span aria-hidden>⚡</span>
        <Tx k="nexconn.badge" />
      </p>

      <section aria-labelledby="problem" className="mt-8">
        <h2 id="problem" className="font-display text-3xl">
          <Tx k="how.problemTitle" />
        </h2>
        <p className="mt-2 text-muted">
          <Tx k="how.problemBody" />
        </p>
      </section>

      <section aria-labelledby="hold" className="mt-8">
        <h2 id="hold" className="font-display text-3xl">
          <Tx k="how.holdTitle" />
        </h2>
        <ol className="mt-3 space-y-2">
          {STEPS.map((i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
              <span className="font-display text-2xl leading-none text-accent">{i + 1}</span>
              <span>
                <Tx k={`how.steps.${i}.t`} />
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-center font-mono text-sm">
          <Tx k="how.formula" />
        </p>
      </section>

      <section aria-labelledby="arch" className="mt-8">
        <h2 id="arch" className="font-display text-3xl">
          <Tx k="how.archTitle" />
        </h2>
        <ol aria-label={t.how.archTitle} className="mt-3 flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
          {FLOW.map((i) => (
            <li key={i} className="flex flex-col items-center gap-1 sm:flex-1 sm:flex-row">
              <div className={`w-full rounded-2xl border p-3 text-center text-sm ${i === 1 ? "border-accent bg-accent/10 font-semibold text-accent" : "border-line bg-surface"}`}>
                <Tx k={`how.flow.${i}.t`} />
              </div>
              {i < FLOW.length - 1 && (
                <span aria-hidden className="text-accent sm:px-1">
                  <span className="sm:hidden">↓</span>
                  <span className="hidden sm:inline">→</span>
                </span>
              )}
            </li>
          ))}
        </ol>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {(["server", "ai"] as const).map((k) => (
            <li key={k} className="rounded-2xl border border-dashed border-line p-3 text-muted">
              <Tx k={`how.side.${k}`} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="table" className="mt-8">
        <h2 id="table" className="font-display text-3xl">
          <Tx k="how.tableTitle" />
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">
                  <Tx k="how.cols.feature" />
                </th>
                <th className="px-3 py-2 font-semibold">
                  <Tx k="how.cols.nexconn" />
                </th>
                <th className="px-3 py-2 font-semibold">
                  <Tx k="how.cols.why" />
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-semibold">
                    <Tx k={`how.rows.${i}.f`} />
                  </td>
                  <td className="px-3 py-2 text-accent">
                    <Tx k={`how.rows.${i}.n`} />
                  </td>
                  <td className="px-3 py-2 text-muted">
                    <Tx k={`how.rows.${i}.w`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/try" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">
          <Tx k="landing.tryIt" />
        </Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener" className="rounded-full border border-line px-6 py-3">
          <Tx k="how.source" />
        </a>
      </div>
    </main>
  );
}
