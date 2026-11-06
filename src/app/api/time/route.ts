export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ts: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
