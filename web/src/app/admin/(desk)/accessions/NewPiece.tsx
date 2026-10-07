"use client";

import { useActionState, useState } from "react";

import { createPieceAction } from "@/app/admin/catalogue-actions";
import { FormNote, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { Drawer } from "@/components/primitives/Drawer";
import { copy } from "@/content/copy";
import { categories } from "@/lib/api/catalog";
import { idleState } from "@/lib/form-state";

/** Opens a draft: one choice, then straight to the piece's own page. */
export function NewPiece() {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  return (
    <>
      <Button
        icon="plus"
        iconPosition="start"
        onClick={() => {
          setRound((n) => n + 1);
          setOpen(true);
        }}
      >
        {copy.accessionsDesk.newPiece}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={copy.accessionsDesk.newTitle}
        description={copy.accessionsDesk.newLede}
      >
        <NewPieceForm key={round} />
      </Drawer>
    </>
  );
}

function NewPieceForm() {
  const [state, formAction, pending] = useActionState(createPieceAction, idleState);
  const focusRef = useActionFocus(state);

  return (
    <div ref={focusRef}>
      <form action={formAction} className="flex flex-col gap-6" noValidate>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 meta text-ink-muted">{copy.accessionsDesk.categoryLabel}</legend>
          {categories.map((category, index) => (
            <label
              key={category}
              className="flex min-h-12 cursor-pointer items-center gap-3 border border-ink-faint p-3 has-checked:border-ink has-checked:bg-paper-2"
            >
              <input
                type="radio"
                name="category"
                value={category}
                defaultChecked={index === 0}
                className="accent-ink"
              />
              <span className="font-display text-lead">{copy.labels.category[category]}</span>
            </label>
          ))}
          {state.fields?.category ? (
            <FormNote tone="error">{state.fields.category}</FormNote>
          ) : null}
        </fieldset>
        {state.status === "error" && state.message ? (
          <FormNote tone="error">{state.message}</FormNote>
        ) : null}
        <Button type="submit" icon="arrow-right" block disabled={pending}>
          {pending ? copy.accessionsDesk.creating : copy.accessionsDesk.create}
        </Button>
      </form>
    </div>
  );
}
