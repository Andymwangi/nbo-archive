import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from "next/font/google";

import { themeColors } from "@/lib/theme";
import { readTheme } from "@/lib/theme-server";
import "@/styles/globals.css";
import "@/motion/motion.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const text = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const meta = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010"),
  title: { default: "nboarchive", template: "%s / nboarchive" },
  description:
    "Thrifted polos, jackets, sweaters, hoodies and tees. Numbered, measured, inspected. Nairobi.",
};

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: themeColors[await readTheme()] };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await readTheme();
  return (
    <html
      lang="en-KE"
      data-theme={theme}
      className={`${display.variable} ${text.variable} ${meta.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
