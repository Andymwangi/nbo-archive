import type { Metadata } from "next";

import { InfoPageView } from "@/components/info/InfoPageView";
import { aboutPage } from "@/content/pages";

export const metadata: Metadata = { title: aboutPage.eyebrow, description: aboutPage.lede };

export default function AboutPage() {
  return <InfoPageView page={aboutPage} />;
}
