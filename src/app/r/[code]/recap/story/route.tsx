import { ImageResponse } from "next/og";
import { RecapArt } from "@/lib/brand";
import { ROOM_CODE_RE } from "@/lib/guard";
import { getRecap } from "@/lib/recap";

// 1080×1920 story image of the squad recap, for Instagram/WhatsApp status. Counts and names only.
export async function GET(_req: Request, ctx: RouteContext<"/r/[code]/recap/story">) {
  const { code } = await ctx.params;
  const r = ROOM_CODE_RE.test(code) ? await getRecap(code).catch(() => null) : null;
  if (!r) return new Response("Not found", { status: 404 });
  return new ImageResponse(<RecapArt r={r} tall />, { width: 1080, height: 1920, headers: { "Cache-Control": "public, max-age=300" } });
}
