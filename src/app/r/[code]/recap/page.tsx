import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Tx } from "@/components/Lang";
import { RecapLanding } from "@/components/Recap";
import { ROOM_CODE_RE } from "@/lib/guard";
import { getRecap } from "@/lib/recap";

export async function generateMetadata(props: PageProps<"/r/[code]/recap">): Promise<Metadata> {
  const { code } = await props.params;
  const r = ROOM_CODE_RE.test(code) ? await getRecap(code).catch(() => null) : null;
  // Counts and names only; messages never appear in metadata or images.
  return {
    title: r ? `Squad recap · ${r.name}` : "Squad recap",
    description: "Every message waited for each screen. Join this squad for the next match.",
    robots: { index: false },
  };
}

export default function RecapPage(props: PageProps<"/r/[code]/recap">) {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center text-muted"><Tx k="recap.loading" /></main>}>
      <RecapLoader {...props} />
    </Suspense>
  );
}

async function RecapLoader(props: PageProps<"/r/[code]/recap">) {
  await connection();
  const { code } = await props.params;
  if (!ROOM_CODE_RE.test(code)) notFound();
  const r = await getRecap(code);
  if (!r) notFound();
  return <RecapLanding r={r} />;
}
