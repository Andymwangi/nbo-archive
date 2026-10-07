"use client";

import { useActionState } from "react";

import { deleteFlawAction, saveFlawAction } from "@/app/admin/catalogue-actions";
import { FormNote, SelectField, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { ConfirmDialog } from "@/components/primitives/Dialog";
import { copy } from "@/content/copy";
import type { AdminPiece } from "@/lib/api/admin";
import type { Flaw } from "@/lib/api/catalog";
import { idleState } from "@/lib/form-state";

type Option = { value: string; label: string };

/** Flaw close-ups first in the picker, since those are the photos a flaw should point at. */
function photoOptions(piece: AdminPiece): Option[] {
  return piece.images
    .map((image, index) => ({ image, index }))
    .sort((a, b) => Number(b.image.kind === "flaw") - Number(a.image.kind === "flaw"))
    .map(({ image, index }) => ({
      value: String(image.id),
      label: `${copy.photosDesk.position(index + 1)}, ${copy.labels.imageKind[image.kind].toLowerCase()}`,
    }));
}

export function FlawList({ piece, readOnly }: { piece: AdminPiece; readOnly: boolean }) {
  const options = photoOptions(piece);
  return (
    <div className="flex flex-col gap-8">
      {piece.flaws.length ? (
        <ol className="flex flex-col gap-6">
          {piece.flaws.map((flaw, index) => (
            <FlawRow
              key={flaw.id}
              pieceId={piece.id}
              flaw={flaw}
              number={index + 1}
              options={options}
              readOnly={readOnly}
            />
          ))}
        </ol>
      ) : (
        <p className="text-meta text-ink-muted">{copy.flawsDesk.none}</p>
      )}
      {readOnly ? null : <NewFlaw pieceId={piece.id} options={options} />}
    </div>
  );
}

function FlawFields({
  state,
  description,
  imageId,
  options,
}: {
  state: { fields?: Record<string, string>; values?: Record<string, string>; status: string };
  description: string;
  imageId: string;
  options: Option[];
}) {
  const failed = state.status === "error" && state.values;
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <TextField
        label={copy.flawsDesk.descriptionLabel}
        hint={copy.flawsDesk.descriptionHint}
        name="description"
        maxLength={280}
        defaultValue={failed ? state.values!.description : description}
        error={state.fields?.description}
      />
      <SelectField
        label={copy.flawsDesk.photoLabel}
        name="image_id"
        defaultValue={failed ? (state.values!.image_id ?? "") : imageId}
        error={state.fields?.image_id}
        placeholder={copy.flawsDesk.noPhoto}
        options={options}
      />
    </div>
  );
}

function FlawRow({
  pieceId,
  flaw,
  number,
  options,
  readOnly,
}: {
  pieceId: number;
  flaw: Flaw;
  number: number;
  options: Option[];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveFlawAction, idleState);
  const [removed, removeAction, removing] = useActionState(deleteFlawAction, idleState);
  const focusRef = useActionFocus(state);
  const removeId = `flaw-${flaw.id}-remove`;

  return (
    <li>
      <div ref={focusRef} className="flex flex-col gap-4 border-t-[1.5px] border-ink pt-3">
        <span className="meta">{copy.flawsDesk.number(number)}</span>
        <form action={formAction} noValidate>
          <input type="hidden" name="id" value={pieceId} />
          <input type="hidden" name="flaw_id" value={flaw.id} />
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <FlawFields
              state={state}
              description={flaw.description}
              imageId={flaw.image_id === null ? "" : String(flaw.image_id)}
              options={options}
            />
            {readOnly ? null : (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="quiet" disabled={pending || removing}>
                  {pending ? copy.pieceDesk.saving : copy.pieceDesk.save}
                </Button>
                <ConfirmDialog
                  formId={removeId}
                  trigger={copy.flawsDesk.remove}
                  triggerIcon="trash"
                  triggerVariant="quiet"
                  title={copy.flawsDesk.removeTitle}
                  body={copy.flawsDesk.removeBody}
                  confirm={copy.flawsDesk.remove}
                  disabled={pending || removing}
                />
              </div>
            )}
          </fieldset>
        </form>
        <form id={removeId} action={removeAction} hidden>
          <input type="hidden" name="id" value={pieceId} />
          <input type="hidden" name="flaw_id" value={flaw.id} />
        </form>
        {state.status !== "idle" && state.message ? (
          <FormNote tone={state.status === "ok" ? "ok" : "error"}>{state.message}</FormNote>
        ) : null}
        {removed.status === "error" && removed.message ? (
          <FormNote tone="error">{removed.message}</FormNote>
        ) : null}
      </div>
    </li>
  );
}

function NewFlaw({ pieceId, options }: { pieceId: number; options: Option[] }) {
  const [state, formAction, pending] = useActionState(saveFlawAction, idleState);
  const focusRef = useActionFocus(state);
  return (
    <div ref={focusRef}>
      {/* React resets the form after each action, so a saved flaw leaves it blank for the next. */}
      <form
        action={formAction}
        className="flex flex-col gap-4 border-[1.5px] border-dashed border-ink-faint p-5"
        noValidate
      >
        <input type="hidden" name="id" value={pieceId} />
        <FlawFields state={state} description="" imageId="" options={options} />
        {state.status === "error" && state.message ? (
          <FormNote tone="error">{state.message}</FormNote>
        ) : null}
        <Button
          type="submit"
          icon="plus"
          iconPosition="start"
          disabled={pending}
          className="self-start"
        >
          {copy.flawsDesk.add}
        </Button>
      </form>
    </div>
  );
}
