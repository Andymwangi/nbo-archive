import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/app/(shop)/account/sign-in/SignInForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { copy } from "@/content/copy";
import { currentCustomer } from "@/lib/customer";

export const metadata: Metadata = {
  title: copy.account.signInTitle,
  robots: { index: false, follow: false },
};

export default async function CustomerSignInPage() {
  if (await currentCustomer()) redirect("/account");
  return (
    <div className="flex max-w-[34rem] flex-col gap-8">
      <PageHeader
        eyebrow={copy.account.signInEyebrow}
        title={copy.account.signInTitle}
        meta={copy.account.signInLede}
      />
      <SignInForm />
    </div>
  );
}
