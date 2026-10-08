import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOutCustomerAction } from "@/app/(shop)/account/actions";
import { ProfileForm } from "@/app/(shop)/account/ProfileForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import { currentCustomer } from "@/lib/customer";

export const metadata: Metadata = {
  title: copy.account.title,
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer) redirect("/account/sign-in");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow={copy.account.eyebrow}
        title={copy.account.title}
        meta={copy.account.signedInAs(customer.email)}
        actions={
          <form action={signOutCustomerAction}>
            <Button type="submit" variant="quiet" icon="logout">
              {copy.account.signOut}
            </Button>
          </form>
        }
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="details" className="flex max-w-[34rem] flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 id="details" className="font-display text-title">
              {copy.account.detailsTitle}
            </h2>
            <p className="text-body text-ink-muted">{copy.account.detailsLede}</p>
          </div>
          <ProfileForm name={customer.name} phone={customer.phone} />
        </section>
        <section aria-labelledby="orders" className="flex flex-col gap-3">
          <h2 id="orders" className="font-display text-title">
            {copy.account.ordersTitle}
          </h2>
          <p className="border-l-[3px] border-ink py-1 pl-4 text-body text-ink-muted">
            {copy.account.ordersSoon}
          </p>
        </section>
      </div>
    </div>
  );
}
