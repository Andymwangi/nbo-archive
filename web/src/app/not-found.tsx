import Link from "next/link";

import { copy } from "@/content/copy";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-between gap-12 px-5 py-8 md:px-8 md:py-12">
      <p className="meta">{copy.brand.name}</p>
      <div className="flex flex-col gap-6">
        <p className="meta text-ink-muted">{copy.system.notFoundEyebrow}</p>
        <p aria-hidden className="font-display text-numeral text-signal">
          NBO-404
        </p>
        <h1 className="max-w-[18ch] font-display text-display">{copy.system.notFoundTitle}</h1>
        <p className="max-w-[40ch] text-lead text-ink-muted">{copy.system.notFoundBody}</p>
      </div>
      <Link href="/" className="self-start meta">
        {copy.system.notFoundBack}
      </Link>
    </main>
  );
}
