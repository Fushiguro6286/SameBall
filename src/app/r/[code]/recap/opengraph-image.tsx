import { ImageResponse } from "next/og";
import { OgCard, RecapArt } from "@/lib/brand";
import { ROOM_CODE_RE } from "@/lib/guard";
import { getRecap } from "@/lib/recap";

export const alt = "Our SameBall squad recap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Counts and names only, never messages.
export default async function RecapOgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = ROOM_CODE_RE.test(code) ? await getRecap(code).catch(() => null) : null;
  return new ImageResponse(r ? <RecapArt r={r} /> : <OgCard title="Watch the next match with us" subtitle="The group chat that never spoils the match." />, size);
}
