"use client";

import { useActionState } from "react";

import { leaveDropListAction } from "@/app/(shop)/drop-list-actions";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import { idleState } from "@/lib/form-state";

export function LeaveDropListForm() {
  const [state, formAction, pending] = useActionState(leaveDropListAction, idleState);
  const focusRef = useActionFocus(state);
  const values = state.values ?? {};

  return (
    <section
      id="leave"
      aria-labelledby="leave-title"
      className="flex max-w-[72ch] flex-col gap-5 border-[1.5px] border-ink p-5 sm:p-7"
    >
      <div className="flex flex-col gap-2">
        <h2 id="leave-title" className="font-display text-title">
          {copy.pages.leaveTitle}
        </h2>
        <p className="text-body text-ink-muted">{copy.pages.leaveLede}</p>
      </div>
      <div ref={focusRef}>
        {state.status === "ok" ? (
          <FormNote tone="ok">{state.message}</FormNote>
        ) : (
          <form action={formAction} className="flex flex-col gap-6" noValidate>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField
                label={copy.footer.phoneLabel}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={values.phone}
                error={state.fields?.phone}
              />
              <TextField
                label={copy.footer.emailLabel}
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
            {state.status === "error" && state.message ? (
              <FormNote tone="error">{state.message}</FormNote>
            ) : null}
            <div>
              <Button type="submit" variant="danger" disabled={pending}>
                {pending ? copy.pages.leaving : copy.pages.leave}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
