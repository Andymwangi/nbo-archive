"use client";

import { useActionState, useState } from "react";

import { requestCodeAction, verifyCodeAction } from "@/app/(shop)/account/actions";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import { idleState } from "@/lib/form-state";

/*
  Two steps on one card: the email, then the code. A successful code request moves to the code
  step; choosing "use a different email" remounts the card to start again.
*/
export function SignInForm() {
  const [attempt, setAttempt] = useState(0);
  return <SignInSteps key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}

function SignInSteps({ onRestart }: { onRestart: () => void }) {
  const [requested, requestAction, requesting] = useActionState(requestCodeAction, idleState);
  const [verified, verifyAction, verifying] = useActionState(verifyCodeAction, idleState);
  const requestFocus = useActionFocus(requested);
  const verifyFocus = useActionFocus(verified);
  const email = verified.email ?? requested.email;

  if (requested.status !== "ok" || !email) {
    return (
      <div ref={requestFocus}>
        <form action={requestAction} className="flex flex-col gap-6" noValidate>
          <TextField
            label={copy.account.emailLabel}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={requested.values?.email}
            error={requested.fields?.email}
            required
          />
          {requested.status === "error" && requested.message ? (
            <FormNote tone="error">{requested.message}</FormNote>
          ) : null}
          <Button type="submit" icon="letter" block disabled={requesting}>
            {requesting ? copy.account.sendingCode : copy.account.sendCode}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div ref={verifyFocus} className="flex flex-col gap-5">
      <form action={verifyAction} className="flex flex-col gap-6" noValidate>
        <input type="hidden" name="email" value={email} />
        <TextField
          label={copy.account.codeLabel}
          hint={copy.account.codeHint(email)}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          defaultValue={verified.values?.code}
          error={verified.fields?.code}
          className="font-meta tracking-[0.3em]"
          required
        />
        {verified.message && !verified.fields?.code ? (
          <FormNote tone="error">{verified.message}</FormNote>
        ) : null}
        <Button type="submit" variant="signal" icon="arrow-right" block disabled={verifying}>
          {verifying ? copy.account.verifying : copy.account.verify}
        </Button>
      </form>
      <div className="flex flex-wrap gap-x-6">
        <form action={requestAction}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="quiet" className="min-h-11" disabled={requesting}>
            {copy.account.resend}
          </Button>
        </form>
        <Button variant="quiet" className="min-h-11" onClick={onRestart}>
          {copy.account.otherEmail}
        </Button>
      </div>
    </div>
  );
}
