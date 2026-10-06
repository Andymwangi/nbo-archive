"use client";

import { useActionState, useState } from "react";

import { requestLinkAction } from "@/app/admin/actions";
import { idleState } from "@/app/admin/form-state";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { IndexCard } from "@/components/layout/IndexCard";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";

export function LoginForm({ expired }: { expired: boolean }) {
  // Remounting the card is the cleanest way to reset the action state for a new address.
  const [attempt, setAttempt] = useState(0);
  return (
    <LoginCard
      key={attempt}
      expired={expired && attempt === 0}
      onRestart={() => setAttempt((n) => n + 1)}
    />
  );
}

function LoginCard({ expired, onRestart }: { expired: boolean; onRestart: () => void }) {
  const [state, formAction, pending] = useActionState(requestLinkAction, idleState);
  const focusRef = useActionFocus(state);

  return (
    <IndexCard eyebrow={copy.login.eyebrow} cardNo="Card 01">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-display">{copy.login.title}</h1>
        <p className="text-body text-ink-muted">{copy.login.lede}</p>
      </div>

      <div ref={focusRef}>
        {state.status === "ok" ? (
          <div className="flex flex-col items-start gap-4">
            <FormNote tone="ok">
              <span className="font-medium">{copy.login.sentTitle}. </span>
              {copy.login.sentBody(state.email ?? "")}
            </FormNote>
            <Button variant="quiet" icon="refresh" iconPosition="start" onClick={onRestart}>
              {copy.login.sentAgain}
            </Button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-6" noValidate>
            {expired ? <FormNote tone="error">{copy.login.expired}</FormNote> : null}
            <TextField
              label={copy.login.emailLabel}
              hint={copy.login.emailHint}
              error={state.fields?.email}
              defaultValue={state.values?.email}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            {state.status === "error" && state.message ? (
              <FormNote tone="error">{state.message}</FormNote>
            ) : null}
            <Button type="submit" icon="letter" block disabled={pending}>
              {pending ? copy.login.submitting : copy.login.submit}
            </Button>
          </form>
        )}
      </div>
    </IndexCard>
  );
}
