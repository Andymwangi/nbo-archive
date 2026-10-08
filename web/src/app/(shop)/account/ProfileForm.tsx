"use client";

import { useActionState } from "react";

import { updateProfileAction } from "@/app/(shop)/account/actions";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import { idleState } from "@/lib/form-state";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, idleState);
  const focusRef = useActionFocus(state);
  const values = state.values ?? { name, phone };

  return (
    <div ref={focusRef}>
      <form action={formAction} className="flex flex-col gap-6" noValidate>
        <TextField
          label={copy.account.nameLabel}
          name="name"
          autoComplete="name"
          defaultValue={values.name}
          error={state.fields?.name}
        />
        <TextField
          label={copy.account.phoneLabel}
          hint={copy.account.phoneHint}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={values.phone}
          error={state.fields?.phone}
        />
        {state.message ? (
          <FormNote tone={state.status === "ok" ? "ok" : "error"}>{state.message}</FormNote>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? copy.account.saving : copy.account.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
