"use client";

import { useActionState } from "react";

import { placeHoldAction, releaseHoldAction } from "@/app/(shop)/hold-actions";
import { idleHoldState } from "@/app/(shop)/hold-state";
import { FormNote, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";

export function PlaceHoldForm({ archiveNo }: { archiveNo: string }) {
  const [state, formAction, pending] = useActionState(placeHoldAction, idleHoldState);
  const focusRef = useActionFocus(state);
  return (
    <div ref={focusRef} className="flex w-full flex-col gap-3">
      <form action={formAction}>
        <input type="hidden" name="archive_no" value={archiveNo} />
        <Button type="submit" variant="signal" icon="arrow-right" block disabled={pending}>
          {pending ? copy.hold.placing : copy.hold.place}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <FormNote tone="error">{state.message}</FormNote>
      ) : null}
    </div>
  );
}

export function ReleaseHoldForm({ holdId, archiveNo }: { holdId: number; archiveNo: string }) {
  const [state, formAction, pending] = useActionState(releaseHoldAction, idleHoldState);
  const focusRef = useActionFocus(state);
  return (
    <div ref={focusRef} className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="hold_id" value={holdId} />
        <input type="hidden" name="archive_no" value={archiveNo} />
        <Button type="submit" variant="quiet" className="min-h-11" disabled={pending}>
          {pending ? copy.hold.releasing : copy.hold.release}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <FormNote tone="error">{state.message}</FormNote>
      ) : null}
    </div>
  );
}
