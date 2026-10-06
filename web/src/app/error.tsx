"use client";

import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-6xl flex-col justify-center gap-6 px-5 py-12 md:px-8">
      <p className="meta text-ink-muted">{copy.system.errorEyebrow}</p>
      <h1 className="max-w-[20ch] font-display text-display">{copy.system.errorTitle}</h1>
      <p className="max-w-[44ch] text-lead text-ink-muted">{copy.system.errorBody}</p>
      {error.digest ? (
        <p className="font-meta text-meta text-ink-faint">Ref {error.digest}</p>
      ) : null}
      <div>
        <Button icon="refresh" onClick={reset}>
          {copy.system.retry}
        </Button>
      </div>
    </main>
  );
}
