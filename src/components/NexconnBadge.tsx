import Link from "next/link";
import { Tx } from "./Lang";

/** "Built on Nexconn Chat SDK", linking to /how-it-works. Works in server and client components. */
export function NexconnBadge({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/how-it-works"
      className={`inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 ${className}`}
    >
      <span aria-hidden>⚡</span>
      <Tx k="nexconn.badge" />
    </Link>
  );
}
