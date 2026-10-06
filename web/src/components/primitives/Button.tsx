import { Slot } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

import { Icon, type IconName } from "@/components/primitives/Icon";

/*
  stamp  -- the primary action. Square, inked, mono label: reads like a rubber stamp block.
  signal -- the one action on a page that commits something irreversible (claim, pay).
  quiet  -- secondary. Underlined text, no box.
  danger -- revokes something. Outlined in signal ink.
*/
type Variant = "stamp" | "signal" | "quiet" | "danger";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 font-meta text-meta uppercase tracking-[0.08em] transition-[transform,background-color,color] duration-[var(--dur-quick)] ease-[var(--ease-settle)] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  stamp: "rounded-tag bg-ink px-5 text-paper active:translate-y-px enabled:hover:bg-ink-muted",
  signal:
    "rounded-tag bg-signal px-5 text-signal-ink active:translate-y-px enabled:hover:brightness-95",
  quiet: "px-1 text-ink underline decoration-1 underline-offset-4 enabled:hover:text-ink-muted",
  danger:
    "rounded-tag border-[1.5px] border-signal px-4 text-signal enabled:hover:bg-signal enabled:hover:text-signal-ink",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  icon?: IconName;
  iconPosition?: "start" | "end";
  asChild?: boolean;
  block?: boolean;
};

export function Button({
  variant = "stamp",
  icon,
  iconPosition = "end",
  asChild = false,
  block = false,
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  const glyph = icon ? <Icon name={icon} size={18} /> : null;
  return (
    <Component
      type={asChild ? undefined : type}
      className={`${base} ${variants[variant]} ${block ? "w-full" : ""} ${className}`}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {iconPosition === "start" && glyph}
          <span>{children}</span>
          {iconPosition === "end" && glyph}
        </>
      )}
    </Component>
  );
}
