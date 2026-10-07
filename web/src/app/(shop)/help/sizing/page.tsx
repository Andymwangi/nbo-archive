import type { Metadata } from "next";

import { InfoPageView } from "@/components/info/InfoPageView";
import { sizingPage } from "@/content/pages";

export const metadata: Metadata = { title: sizingPage.title, description: sizingPage.lede };

export default function SizingPage() {
  return <InfoPageView page={sizingPage} />;
}
