import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/brand";
import { t } from "@/lib/i18n";

export const alt = t.tagline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(<OgCard title={t.tagline} subtitle={t.pitch} />, size);
}
