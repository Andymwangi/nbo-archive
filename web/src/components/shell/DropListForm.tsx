"use client";

import { useActionState, useId } from "react";

import { joinDropListAction } from "@/app/(shop)/drop-list-actions";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import { idleState } from "@/lib/form-state";

export function DropListForm() {
  const [state, formAction, pending] = useActionState(joinDropListAction, idleState);
  const focusRef = useActionFocus(state);
  const consentId = useId();
  const values = state.values ?? {};

  return (
    <div ref={focusRef}>
      {state.status === "ok" ? (
        <FormNote tone="ok">{state.message}</FormNote>
      ) : (
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              label={copy.footer.phoneLabel}
              hint={copy.footer.phoneHint}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={values.phone}
              error={state.fields?.phone}
            />
            <TextField
              label={copy.footer.emailLabel}
              hint={copy.footer.either}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={values.email}
              error={state.fields?.email}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3 text-meta">
              <input
                id={consentId}
                type="checkbox"
                name="consent"
                defaultChecked={values.consent === "on"}
                aria-invalid={state.fields?.consent ? true : undefined}
                aria-describedby={state.fields?.consent ? `${consentId}-error` : undefined}
                className="mt-0.5 size-5 shrink-0 accent-signal"
              />
              <span>{copy.footer.consent}</span>
            </label>
            {state.fields?.consent ? (
              <p id={`${consentId}-error`} role="alert" className="text-meta text-signal">
                {state.fields.consent}
              </p>
            ) : null}
          </div>
          {state.status === "error" && state.message ? (
            <FormNote tone="error">{state.message}</FormNote>
          ) : null}
          <div>
            <Button type="submit" variant="signal" icon="arrow-right" disabled={pending}>
              {pending ? copy.footer.joining : copy.footer.join}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
