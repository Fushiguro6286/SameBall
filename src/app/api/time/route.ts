import { connection } from "next/server";

export async function GET() {
  await connection(); // always request-time: this is the clock
  return Response.json({ ts: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
