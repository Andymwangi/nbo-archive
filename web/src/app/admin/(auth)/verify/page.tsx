import Link from "next/link";

import { VerifyForm } from "@/app/admin/(auth)/verify/VerifyForm";
import { FormNote } from "@/components/form/Field";
import { IndexCard } from "@/components/layout/IndexCard";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";

/*
  Opening the emailed link only renders this page. The token is spent when the person taps
  the button (a POST), so mail scanners that pre-fetch links cannot burn it.
*/
export default async function VerifyPage({ searchParams }: PageProps<"/admin/verify">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || token.length < 20) {
    return (
      <IndexCard eyebrow={copy.verify.eyebrow} cardNo="Card 02">
        <h1 className="font-display text-display">{copy.verify.title}</h1>
        <FormNote tone="error">{copy.verify.missingToken}</FormNote>
        <Button asChild variant="stamp" block>
          <Link href="/admin/login">{copy.verify.requestNew}</Link>
        </Button>
      </IndexCard>
    );
  }

  return <VerifyForm token={token} />;
}
