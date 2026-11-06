import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/brand";

export const alt = "Join my spoiler-free match room";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Never includes messages. The room name is not shown either, so the card stays generic.
export default function RoomOgImage() {
  return new ImageResponse(
    <OgCard title="Join my spoiler-free match room" subtitle="Everyone sees each message when the moment reaches their own screen." />,
    size,
  );
}
