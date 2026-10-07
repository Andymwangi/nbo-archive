"use client";

import { useActionState, useState } from "react";

import { dropTransitionAction, saveDropDetailsAction } from "@/app/admin/catalogue-actions";
import { FormNote, TextAreaField, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { ConfirmDialog } from "@/components/primitives/Dialog";
import { Drawer } from "@/components/primitives/Drawer";
import { copy } from "@/content/copy";
import type { AdminDrop } from "@/lib/api/admin";
import { type FormState, idleState } from "@/lib/form-state";
import { toNairobiInput } from "@/lib/format";

const label = (drop: AdminDrop) => String(drop.number).padStart(2, "0");

function Result({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <FormNote tone={state.status === "ok" ? "ok" : "error"}>{state.message}</FormNote>;
}

/** Opens a drawer; `drop` edits an existing drop, otherwise a new one is opened. */
export function DropDrawer({ drop }: { drop?: AdminDrop }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <>
      <Button
        variant={drop ? "quiet" : "stamp"}
        icon={drop ? "edit" : "plus"}
        iconPosition="start"
        onClick={() => {
          setRound((n) => n + 1);
          setOpen(true);
        }}
        aria-label={
          drop ? `${copy.dropsDesk.edit}: ${copy.dropsDesk.editTitle(label(drop))}` : undefined
        }
      >
        {drop ? copy.dropsDesk.edit : copy.dropsDesk.newDrop}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={drop ? copy.dropsDesk.editTitle(label(drop)) : copy.dropsDesk.newTitle}
        description={drop ? undefined : copy.dropsDesk.newLede}
      >
        <div key={round} className="flex flex-col gap-10">
          <DetailsForm drop={drop} />
          {drop && drop.status !== "released" ? <ReleaseControls drop={drop} /> : null}
        </div>
      </Drawer>
    </>
  );
}

function DetailsForm({ drop }: { drop?: AdminDrop }) {
  const [state, formAction, pending] = useActionState(saveDropDetailsAction, idleState);
  const focusRef = useActionFocus(state);
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (!drop && state.status === "ok") {
    return (
      <div ref={focusRef}>
        <Result state={state} />
      </div>
    );
  }
  return (
    <div ref={focusRef}>
      <form action={formAction} className="flex flex-col gap-6" noValidate>
        {drop ? <input type="hidden" name="drop_id" value={drop.id} /> : null}
        <TextField
          label={copy.dropsDesk.titleLabel}
          name="title"
          maxLength={120}
          required
          defaultValue={values.title ?? drop?.title ?? ""}
          error={state.fields?.title}
        />
        <TextAreaField
          label={copy.dropsDesk.introLabel}
          hint={copy.dropsDesk.introHint}
          name="intro"
          rows={4}
          defaultValue={values.intro ?? drop?.intro ?? ""}
          error={state.fields?.intro}
        />
        <Result state={state} />
        <Button type="submit" block={!drop} disabled={pending} className="self-start">
          {drop ? copy.dropsDesk.save : pending ? copy.dropsDesk.creating : copy.dropsDesk.create}
        </Button>
      </form>
    </div>
  );
}

function ReleaseControls({ drop }: { drop: AdminDrop }) {
  const [state, formAction, pending] = useActionState(dropTransitionAction, idleState);
  const focusRef = useActionFocus(state);
  const releaseId = `drop-${drop.id}-release`;
  const deleteId = `drop-${drop.id}-delete`;

  return (
    <div ref={focusRef} className="flex flex-col gap-6 border-t-[1.5px] border-ink pt-6">
      <form action={formAction} className="flex flex-col gap-6" noValidate>
        <input type="hidden" name="intent" value="schedule" />
        <input type="hidden" name="drop_id" value={drop.id} />
        <TextField
          label={copy.dropsDesk.scheduleLabel}
          hint={copy.dropsDesk.scheduleHint}
          name="release_at"
          type="datetime-local"
          required
          defaultValue={
            state.status === "error" && state.values?.release_at !== undefined
              ? state.values.release_at
              : toNairobiInput(drop.release_at)
          }
          error={state.fields?.release_at}
        />
        <Button
          type="submit"
          variant="stamp"
          icon="calendar"
          iconPosition="start"
          disabled={pending}
          className="self-start"
        >
          {copy.dropsDesk.schedule}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <ConfirmDialog
          formId={releaseId}
          trigger={copy.dropsDesk.release}
          triggerVariant="signal"
          title={copy.dropsDesk.releaseTitle(label(drop))}
          body={copy.dropsDesk.releaseBody}
          confirm={copy.dropsDesk.release}
          disabled={pending}
        />
        {drop.status === "draft" ? (
          <ConfirmDialog
            formId={deleteId}
            trigger={copy.dropsDesk.delete}
            triggerIcon="trash"
            title={copy.dropsDesk.deleteTitle(label(drop))}
            body={copy.dropsDesk.deleteBody}
            confirm={copy.dropsDesk.delete}
            disabled={pending}
          />
        ) : null}
      </div>
      <form id={releaseId} action={formAction} hidden>
        <input type="hidden" name="intent" value="release" />
        <input type="hidden" name="drop_id" value={drop.id} />
      </form>
      <form id={deleteId} action={formAction} hidden>
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="drop_id" value={drop.id} />
      </form>
      <Result state={state} />
    </div>
  );
}
