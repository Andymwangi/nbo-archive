import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from "next/font/google";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eee8dc" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-KE" className={`${display.variable} ${text.variable} ${meta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
