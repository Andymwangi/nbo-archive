"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { pieceTransitionAction } from "@/app/admin/catalogue-actions";
import { idleState } from "@/app/admin/form-state";
import { FormNote, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { ConfirmDialog } from "@/components/primitives/Dialog";
import { Drawer } from "@/components/primitives/Drawer";
import { copy } from "@/content/copy";
import type { AdminPiece } from "@/lib/api/admin";
import { toNairobiInput } from "@/lib/format";

const PUBLIC = new Set(["live", "held", "claimed"]);

/** The quick actions at the top of a piece: only the moves its current status allows. */
export function PieceActions({ piece, readOnly }: { piece: AdminPiece; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState(pieceTransitionAction, idleState);
  const focusRef = useActionFocus(state);
  const status = piece.status;
  const canPublish = status === "draft" || status === "scheduled" || status === "withdrawn";
  const canWithdraw = status === "live" || status === "scheduled";
  const formId = (intent: string) => `piece-${piece.id}-${intent}`;

  return (
    <div ref={focusRef} className="flex flex-col items-start gap-3 sm:items-end">
      <div className="flex flex-wrap items-center gap-3">
        {PUBLIC.has(status) ? (
          <Button asChild variant="quiet">
            <Link href={`/item/${piece.archive_no}`} target="_blank" rel="noopener">
              {copy.pieceDesk.viewOnSite}
            </Link>
          </Button>
        ) : null}
        {!readOnly && status === "draft" ? (
          <ConfirmDialog
            formId={formId("delete")}
            trigger={copy.pieceDesk.deleteDraft}
            triggerIcon="trash"
            title={copy.pieceDesk.deleteTitle}
            body={copy.pieceDesk.deleteBody(piece.archive_no)}
            confirm={copy.pieceDesk.deleteDraft}
            disabled={pending}
          />
        ) : null}
        {!readOnly && canWithdraw ? (
          <ConfirmDialog
            formId={formId("withdraw")}
            trigger={copy.pieceDesk.withdraw}
            title={copy.pieceDesk.withdrawTitle}
            body={copy.pieceDesk.withdrawBody}
            confirm={copy.pieceDesk.withdraw}
            disabled={pending}
          />
        ) : null}
        {!readOnly && canPublish ? <ScheduleButton piece={piece} /> : null}
        {!readOnly && canPublish ? (
          <Button type="submit" form={formId("publish")} icon="check" disabled={pending}>
            {copy.pieceDesk.publish}
          </Button>
        ) : null}
      </div>

      {["publish", "withdraw", "delete"].map((intent) => (
        <form key={intent} id={formId(intent)} action={formAction} hidden>
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="id" value={piece.id} />
        </form>
      ))}

      {state.status === "ok" && state.message ? (
        <FormNote tone="ok">{state.message}</FormNote>
      ) : null}
      {state.status === "error" && state.message ? (
        <FormNote tone="error">{state.message}</FormNote>
      ) : null}
    </div>
  );
}

function ScheduleButton({ piece }: { piece: AdminPiece }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <>
      <Button
        variant="quiet"
        icon="calendar"
        iconPosition="start"
        onClick={() => {
          setRound((n) => n + 1);
          setOpen(true);
        }}
      >
        {copy.pieceDesk.schedule}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={copy.pieceDesk.scheduleTitle}
        description={copy.pieceDesk.scheduleLede}
      >
        <ScheduleForm key={round} piece={piece} />
      </Drawer>
    </>
  );
}

function ScheduleForm({ piece }: { piece: AdminPiece }) {
  const [state, formAction, pending] = useActionState(pieceTransitionAction, idleState);
  const focusRef = useActionFocus(state);
  const inDrop = piece.drop !== null;

  return (
    <div ref={focusRef}>
      {state.status === "ok" ? (
        <FormNote tone="ok">{state.message}</FormNote>
      ) : (
        <form action={formAction} className="flex flex-col gap-6" noValidate>
          <input type="hidden" name="intent" value="schedule" />
          <input type="hidden" name="id" value={piece.id} />
          <input type="hidden" name="in_drop" value={inDrop ? "1" : "0"} />
          {inDrop && piece.drop ? (
            <p className="text-body">
              {copy.pieceDesk.scheduleInDrop(String(piece.drop.number).padStart(2, "0"))}
            </p>
          ) : (
            <TextField
              label={copy.pieceDesk.releaseAtLabel}
              hint={copy.pieceDesk.releaseAtHint}
              name="release_at"
              type="datetime-local"
              required
              defaultValue={state.values?.release_at ?? toNairobiInput(piece.release_at)}
              error={state.fields?.release_at}
            />
          )}
          {state.status === "error" && state.message ? (
            <FormNote tone="error">{state.message}</FormNote>
          ) : null}
          <Button type="submit" icon="calendar" block disabled={pending}>
            {copy.pieceDesk.scheduleConfirm}
          </Button>
        </form>
      )}
    </div>
  );
}
