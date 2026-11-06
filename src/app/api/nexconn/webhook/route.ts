import { db, ncMessages } from "@/lib/db";
import { fail } from "@/lib/http";
import { verifySignature } from "@/lib/nexconn-server";
import { parseWebhook } from "@/lib/webhook";

// The signature covers only Nonce + Timestamp (not the body), so stale timestamps are rejected to limit replays.
const MAX_SKEW_MS = 5 * 60_000;

// Nexconn post-message webhook: the primary, server-side source for message and active-user counts.
// Nexconn retries non-2xx up to twice; rows are keyed by message id, so retries never double-count.
export async function POST(req: Request) {
  const h = req.headers;
  const ts = h.get("timestamp");
  if (!verifySignature(h.get("nonce"), ts, h.get("signature"))) return fail(401, "bad_signature");
  if (Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return fail(401, "stale");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 }); // nothing to retry
  }
  const rows = parseWebhook(body);
  if (rows.length) {
    try {
      await db().insert(ncMessages).values(rows).onConflictDoNothing();
    } catch (e) {
      console.error("webhook store failed", (e as Error).message);
      return fail(500, "error"); // let Nexconn retry
    }
  }
  return new Response(null, { status: 204 });
}
