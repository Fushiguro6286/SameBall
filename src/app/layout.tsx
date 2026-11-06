import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist, Noto_Sans_Devanagari } from "next/font/google";
import { ErrorReporter } from "@/components/ErrorReporter";
import { LangInit } from "@/components/Lang";
import { t } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Bebas_Neue({ variable: "--font-display-face", weight: "400", subsets: ["latin"] });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "600", "700"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: { default: `${t.appName} · ${t.tagline}`, template: `%s · ${t.appName}` },
  description: t.pitch,
  applicationName: t.appName,
  appleWebApp: { capable: true, title: t.appName, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#070b18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${display.variable} ${devanagari.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ErrorReporter />
        <LangInit />
        {children}
      </body>
    </html>
  );
}
