import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeaveDropListForm } from "@/components/info/LeaveDropListForm";
import { InfoPageView } from "@/components/info/InfoPageView";
import { type PolicySlug, policyPages } from "@/content/pages";

function policy(slug: string) {
  return Object.hasOwn(policyPages, slug) ? policyPages[slug as PolicySlug] : null;
}

export function generateStaticParams() {
  return Object.keys(policyPages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const page = policy((await params).slug);
  return page ? { title: page.title, description: page.lede } : {};
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const page = policy(slug);
  if (!page) notFound();
  return (
    <InfoPageView page={page}>{slug === "privacy" ? <LeaveDropListForm /> : null}</InfoPageView>
  );
}
