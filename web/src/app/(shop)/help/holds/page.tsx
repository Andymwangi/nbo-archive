import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoPageView } from "@/components/info/InfoPageView";
import { holdsPage } from "@/content/pages";
import { holdsEnabled } from "@/lib/visitor";

export const metadata: Metadata = { title: holdsPage.title, description: holdsPage.lede };

export default function HowHoldsWorkPage() {
  // Explaining a feature that is switched off would only confuse; the page opens with holds.
  if (!holdsEnabled()) notFound();
  return <InfoPageView page={holdsPage} />;
}
