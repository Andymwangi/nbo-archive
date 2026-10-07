"use client";

import { AlertDialog } from "radix-ui";

import { Button } from "@/components/primitives/Button";
import type { IconName } from "@/components/primitives/Icon";

/*
  A confirmation slip for actions that cannot be taken back (withdrawing a piece, deleting a
  draft, releasing a drop). The confirm button submits the form named by `formId`, so the
  action still runs through the form's server action and its pending state.
  Radix AlertDialog keeps focus on Cancel by default, traps focus and closes on Escape.
*/
type ConfirmDialogProps = {
  formId: string;
  trigger: string;
  triggerIcon?: IconName;
  triggerVariant?: "stamp" | "signal" | "quiet" | "danger";
  title: string;
  body: string;
  confirm: string;
  cancel?: string;
  disabled?: boolean;
};

export function ConfirmDialog({
  formId,
  trigger,
  triggerIcon,
  triggerVariant = "danger",
  title,
  body,
  confirm,
  cancel = "Keep it",
  disabled = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button
          variant={triggerVariant}
          icon={triggerIcon}
          iconPosition="start"
          disabled={disabled}
        >
          {trigger}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-ink/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 border-[1.5px] border-ink bg-paper p-6">
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="font-display text-title">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-body text-ink-muted">
              {body}
            </AlertDialog.Description>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="quiet">{cancel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={triggerVariant === "quiet" ? "stamp" : triggerVariant}
                type="submit"
                form={formId}
              >
                {confirm}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
