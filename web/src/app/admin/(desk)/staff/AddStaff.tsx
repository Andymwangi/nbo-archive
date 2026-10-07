"use client";

import { useActionState, useState } from "react";

import { createStaffAction } from "@/app/admin/actions";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { Drawer } from "@/components/primitives/Drawer";
import { copy } from "@/content/copy";
import { adminRoleSchema } from "@/lib/api/types";
import { idleState } from "@/lib/form-state";

export function AddStaff() {
  const [open, setOpen] = useState(false);
  // Bumping the key remounts the form, resetting its action state and inputs. It happens on
  // open rather than close so the form does not blank out during the closing slide.
  const [round, setRound] = useState(0);

  return (
    <>
      <Button
        icon="user-plus"
        onClick={() => {
          setRound((n) => n + 1);
          setOpen(true);
        }}
      >
        {copy.staff.add}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={copy.staff.addTitle}
        description={copy.staff.addLede}
      >
        <AddStaffForm key={round} onAnother={() => setRound((n) => n + 1)} />
      </Drawer>
    </>
  );
}

function AddStaffForm({ onAnother }: { onAnother: () => void }) {
  const [state, formAction, pending] = useActionState(createStaffAction, idleState);
  const focusRef = useActionFocus(state);
  const values = state.values ?? {};
  const selectedRole = values.role ?? "editor";

  return (
    <div ref={focusRef}>
      {state.status === "ok" ? (
        <div className="flex flex-col items-start gap-4">
          <FormNote tone="ok">{state.message}</FormNote>
          <Button variant="quiet" icon="user-plus" iconPosition="start" onClick={onAnother}>
            {copy.staff.add}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <TextField
            label={copy.staff.nameLabel}
            name="name"
            autoComplete="off"
            defaultValue={values.name}
            error={state.fields?.name}
            required
          />
          <TextField
            label={copy.staff.emailLabel}
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={values.email}
            error={state.fields?.email}
            required
          />
          <TextField
            label={copy.staff.phoneLabel}
            hint={copy.staff.phoneHint}
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={values.phone}
            error={state.fields?.phone}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 meta text-ink-muted">{copy.staff.roleLabel}</legend>
            {adminRoleSchema.options.map((role) => (
              <label
                key={role}
                className="flex min-h-12 cursor-pointer items-start gap-3 border border-ink-faint p-3 has-checked:border-ink has-checked:bg-paper-2"
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  defaultChecked={role === selectedRole}
                  className="mt-1 accent-ink"
                />
                <span className="flex flex-col">
                  <span className="font-meta text-meta uppercase">{role}</span>
                  <span className="text-meta text-ink-muted">
                    {copy.staff.roleDescriptions[role]}
                  </span>
                </span>
              </label>
            ))}
            {state.fields?.role ? <FormNote tone="error">{state.fields.role}</FormNote> : null}
          </fieldset>
          {state.status === "error" && state.message ? (
            <FormNote tone="error">{state.message}</FormNote>
          ) : null}
          <Button type="submit" icon="arrow-right" block disabled={pending}>
            {pending ? copy.staff.creating : copy.staff.create}
          </Button>
        </form>
      )}
    </div>
  );
}
