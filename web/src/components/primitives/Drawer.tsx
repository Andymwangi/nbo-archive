"use client";

import { Dialog } from "radix-ui";

import { Icon } from "@/components/primitives/Icon";

/*
  The archive drawer. On phones it slides up from the bottom edge like pulling a card tray
  toward you; from md up it slides in from the right as a filing panel.
  Radix provides focus trapping, escape handling and aria wiring; every visual is ours.
*/
type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function Drawer({ open, onOpenChange, title, description, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className="drawer-panel fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto border-t-[1.5px] border-ink bg-paper px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[28rem] md:border-t-0 md:border-l-[1.5px] md:px-8 md:pt-8"
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 bg-ink-faint md:hidden" />
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-meta text-ink-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mr-2 grid size-11 shrink-0 place-items-center"
              aria-label="Close"
            >
              <Icon name="close" size={22} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
