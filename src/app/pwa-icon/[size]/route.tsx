import { ImageResponse } from "next/og";
import { Mark } from "@/lib/brand";

const SIZES = ["192", "512"];
export const generateStaticParams = () => SIZES.map((size) => ({ size }));

// PNG icons for the web manifest.
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const n = Number((await ctx.params).size);
  return new ImageResponse(<Mark size={n} />, { width: n, height: n });
}
