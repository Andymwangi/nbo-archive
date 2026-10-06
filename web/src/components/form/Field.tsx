"use client";

import { type ComponentPropsWithoutRef, useEffect, useId, useRef } from "react";

/*
  A care-label field: tiny uppercase label above, a single inked baseline for the input,
  hint and error printed underneath like the small text on a garment tag.
  Focus keeps the global dashed chalk outline; an invalid field gets a heavier signal rule
  plus a printed "!" message, so the state never relies on colour alone.
*/
type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
};

const control =
  "block w-full min-h-12 border-0 border-b-[1.5px] border-ink bg-transparent px-0 py-2 text-lead aria-[invalid=true]:border-b-[3px] aria-[invalid=true]:border-signal";

export function TextField({
  label,
  hint,
  error,
  className = "",
  ...props
}: BaseProps & ComponentPropsWithoutRef<"input">) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="meta text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${control} ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-meta text-signal">
          <span aria-hidden className="font-meta">
            !{" "}
          </span>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-meta text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A form-level message: success notes in tag green, failures in signal. It can take focus so
 * the result of an action is announced and keyboard users land on it.
 */
export function FormNote({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
      data-action-result
      className={`border-l-[3px] py-1 pl-3 text-meta ${tone === "error" ? "border-signal text-signal" : "border-tag text-tag"}`}
    >
      <span aria-hidden className="font-meta">
        {tone === "error" ? "! " : "+ "}
      </span>
      {children}
    </p>
  );
}

/**
 * After an action settles, move focus to the first invalid field, or else to the result note.
 * Attach the returned ref to the element that wraps the form and its messages.
 */
export function useActionFocus(state: { status: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "idle" || !ref.current) return;
    const target =
      ref.current.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      ref.current.querySelector<HTMLElement>("[data-action-result]");
    target?.focus();
  }, [state]);
  return ref;
}
