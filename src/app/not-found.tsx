import Link from "next/link";
import { Tx } from "@/components/Lang";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-5xl">404</h1>
      <p className="max-w-xs text-muted"><Tx k="room.notFound" /></p>
      <Link href="/" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">
        <Tx k="landing.createRoom" />
      </Link>
    </main>
  );
}
