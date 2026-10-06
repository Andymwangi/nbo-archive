"use client";

import Link from "next/link";
import { useActionState } from "react";

import { verifyLinkAction } from "@/app/admin/actions";
import { idleState } from "@/app/admin/form-state";
import { FormNote, useActionFocus } from "@/components/form/Field";
import { IndexCard } from "@/components/layout/IndexCard";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";

export function VerifyForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(verifyLinkAction, idleState);
  const focusRef = useActionFocus(state);
  // A spent or bad link is final; anything else (network, server, throttling) can be retried.
  const linkDead = Boolean(state.fields?.token);

  return (
    <IndexCard eyebrow={copy.verify.eyebrow} cardNo="Card 02">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-display">{copy.verify.title}</h1>
        <p className="text-body text-ink-muted">{copy.verify.lede}</p>
      </div>

      <div ref={focusRef} className="flex flex-col gap-5">
        {state.status === "error" ? (
          <FormNote tone="error">{state.fields?.token ?? state.message}</FormNote>
        ) : null}
        {linkDead ? (
          <Button asChild variant="stamp" block>
            <Link href="/admin/login">{copy.verify.requestNew}</Link>
          </Button>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" variant="signal" icon="arrow-right" block disabled={pending}>
              {pending
                ? copy.verify.submitting
                : state.status === "error"
                  ? copy.verify.retry
                  : copy.verify.submit}
            </Button>
          </form>
        )}
      </div>
    </IndexCard>
  );
}
