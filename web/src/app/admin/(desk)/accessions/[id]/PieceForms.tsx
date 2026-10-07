"use client";

import { useActionState } from "react";

import {
  saveDropAction,
  saveExtrasAction,
  saveMeasurementsAction,
  savePieceDetailsAction,
} from "@/app/admin/catalogue-actions";
import {
  FormNote,
  SelectField,
  TextAreaField,
  TextField,
  useActionFocus,
} from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import type { AdminDrop, AdminPiece } from "@/lib/api/admin";
import { categories, conditions } from "@/lib/api/catalog";
import { type FormState, idleState } from "@/lib/form-state";
import { categoryExtras, extraField, measurementField, measurementKeys } from "@/lib/piece-spec";

/*
  The piece page saves section by section: each form PATCHes only its own fields, so a mistake
  in one section never blocks saving another, and errors land next to the field that caused
  them. After a failed save the submitted values are echoed back (React resets the form after
  every action), otherwise the inputs show what is on file.
*/

type FormProps = { piece: AdminPiece; readOnly: boolean };

function Result({ state }: { state: FormState }) {
  if (state.status === "ok" && state.message) return <FormNote tone="ok">{state.message}</FormNote>;
  if (state.status === "error" && state.message) {
    return <FormNote tone="error">{state.message}</FormNote>;
  }
  return null;
}

function SaveRow({
  state,
  pending,
  readOnly,
}: {
  state: FormState;
  pending: boolean;
  readOnly: boolean;
}) {
  if (readOnly) return null;
  return (
    <div className="flex flex-col items-start gap-3 sm:col-span-2">
      <Result state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? copy.pieceDesk.saving : copy.pieceDesk.save}
      </Button>
    </div>
  );
}

/** The submitted value after a failed save, otherwise what is on file. */
function pick(state: FormState, name: string, stored: string): string {
  return state.status === "error" && state.values && name in state.values
    ? state.values[name]!
    : stored;
}

export function DetailsForm({ piece, readOnly }: FormProps) {
  const [state, formAction, pending] = useActionState(savePieceDetailsAction, idleState);
  const focusRef = useActionFocus(state);
  const value = (name: string, stored: string | number | null) =>
    pick(state, name, stored === null ? "" : String(stored));
  const fields = copy.pieceDesk.fields;

  return (
    <div ref={focusRef}>
      <form action={formAction} noValidate>
        <input type="hidden" name="id" value={piece.id} />
        <fieldset disabled={readOnly} className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label={fields.title}
              name="title"
              maxLength={120}
              defaultValue={value("title", piece.title)}
              error={state.fields?.title}
            />
          </div>
          <SelectField
            label={fields.category}
            hint={fields.categoryHint}
            name="category"
            defaultValue={value("category", piece.category)}
            error={state.fields?.category}
            options={categories.map((c) => ({ value: c, label: copy.labels.category[c] }))}
          />
          <SelectField
            label={fields.condition}
            name="condition_grade"
            defaultValue={value("condition_grade", piece.condition_grade)}
            error={state.fields?.condition_grade}
            placeholder={fields.notSet}
            options={conditions.map((c) => ({ value: c, label: copy.labels.condition[c] }))}
          />
          <TextField
            label={fields.brand}
            name="brand"
            maxLength={80}
            defaultValue={value("brand", piece.brand)}
            error={state.fields?.brand}
          />
          <TextField
            label={fields.taggedSize}
            name="tagged_size"
            maxLength={24}
            defaultValue={value("tagged_size", piece.tagged_size)}
            error={state.fields?.tagged_size}
          />
          <TextField
            label={fields.colour}
            name="colour"
            maxLength={40}
            defaultValue={value("colour", piece.colour)}
            error={state.fields?.colour}
          />
          <TextField
            label={fields.fitNote}
            hint={fields.fitNoteHint}
            name="fit_note"
            maxLength={120}
            defaultValue={value("fit_note", piece.fit_note)}
            error={state.fields?.fit_note}
          />
          <TextField
            label={fields.fabric}
            name="fabric_composition"
            maxLength={160}
            defaultValue={value("fabric_composition", piece.fabric_composition)}
            error={state.fields?.fabric_composition}
          />
          <TextField
            label={fields.era}
            name="era"
            maxLength={40}
            defaultValue={value("era", piece.era)}
            error={state.fields?.era}
          />
          <TextField
            label={fields.cleanedAt}
            name="cleaned_at"
            type="date"
            defaultValue={value("cleaned_at", piece.cleaned_at)}
            error={state.fields?.cleaned_at}
          />
          <TextField
            label={fields.price}
            name="price_kes"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={value("price_kes", piece.price_kes)}
            error={state.fields?.price_kes}
          />
          <div className="sm:col-span-2">
            <TextAreaField
              label={fields.provenance}
              name="provenance_note"
              maxLength={600}
              rows={3}
              defaultValue={value("provenance_note", piece.provenance_note)}
              error={state.fields?.provenance_note}
            />
          </div>
          <SaveRow state={state} pending={pending} readOnly={readOnly} />
        </fieldset>
      </form>
    </div>
  );
}

export function MeasurementsForm({ piece, readOnly }: FormProps) {
  const [state, formAction, pending] = useActionState(saveMeasurementsAction, idleState);
  const focusRef = useActionFocus(state);

  return (
    <div ref={focusRef}>
      <form action={formAction} noValidate>
        <input type="hidden" name="id" value={piece.id} />
        <fieldset disabled={readOnly} className="grid gap-6 sm:grid-cols-2">
          {measurementKeys.map((key) => {
            const name = measurementField(key);
            const stored = piece.measurements[key];
            return (
              <TextField
                key={key}
                label={copy.labels.measurement[key]}
                name={name}
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={pick(state, name, stored === undefined ? "" : String(stored))}
                error={state.fields?.[name]}
              />
            );
          })}
          <SaveRow state={state} pending={pending} readOnly={readOnly} />
        </fieldset>
      </form>
    </div>
  );
}

export function ExtrasForm({ piece, readOnly }: FormProps) {
  const [state, formAction, pending] = useActionState(saveExtrasAction, idleState);
  const focusRef = useActionFocus(state);
  const spec = categoryExtras[piece.category];

  return (
    <div ref={focusRef}>
      {/* Keyed by category so switching garments resets the fields to the new set. */}
      <form key={piece.category} action={formAction} noValidate>
        <input type="hidden" name="id" value={piece.id} />
        <input type="hidden" name="category" value={piece.category} />
        <fieldset disabled={readOnly} className="grid gap-6 sm:grid-cols-2">
          {Object.entries(spec).map(([key, choices]) => {
            const name = extraField(key);
            const label = copy.labels.extras[key] ?? key;
            const stored = pick(state, name, piece.category_extras[key] ?? "");
            return choices ? (
              <SelectField
                key={key}
                label={label}
                name={name}
                defaultValue={stored}
                error={state.fields?.[name]}
                placeholder={copy.pieceDesk.notRecorded}
                options={choices.map((choice) => ({ value: choice, label: choice }))}
              />
            ) : (
              <TextField
                key={key}
                label={label}
                name={name}
                maxLength={80}
                defaultValue={stored}
                error={state.fields?.[name]}
              />
            );
          })}
          <SaveRow state={state} pending={pending} readOnly={readOnly} />
        </fieldset>
      </form>
    </div>
  );
}

export function DropForm({ piece, readOnly, drops }: FormProps & { drops: readonly AdminDrop[] }) {
  const [state, formAction, pending] = useActionState(saveDropAction, idleState);
  const focusRef = useActionFocus(state);
  // Keep the current drop selectable even when it fell off the first page of drops.
  const options = drops.map((drop) => ({
    value: String(drop.id),
    label: copy.pieceDesk.dropOption(
      String(drop.number).padStart(2, "0"),
      drop.title,
      copy.dropsDesk.status[drop.status],
    ),
  }));
  if (piece.drop_id !== null && !drops.some((drop) => drop.id === piece.drop_id) && piece.drop) {
    options.unshift({
      value: String(piece.drop_id),
      label: copy.pieceDesk.dropOption(
        String(piece.drop.number).padStart(2, "0"),
        piece.drop.title,
      ),
    });
  }

  return (
    <div ref={focusRef}>
      <form action={formAction} noValidate>
        <input type="hidden" name="id" value={piece.id} />
        <fieldset disabled={readOnly} className="grid gap-6 sm:grid-cols-2">
          <SelectField
            label={copy.pieceDesk.dropLabel}
            hint={copy.pieceDesk.dropHint}
            name="drop_id"
            defaultValue={piece.drop_id === null ? "" : String(piece.drop_id)}
            error={state.fields?.drop_id}
            placeholder={copy.pieceDesk.noDrop}
            options={options}
          />
          <SaveRow state={state} pending={pending} readOnly={readOnly} />
        </fieldset>
      </form>
    </div>
  );
}
