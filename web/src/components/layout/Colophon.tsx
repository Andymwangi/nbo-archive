import Link from "next/link";

import { copy } from "@/content/copy";

/*
  A printed colophon, the closing note of a catalogue: what this is, where it is made, how it is
  set. No link columns, no social icon row.
*/
export function Colophon() {
  return (
    <footer className="mt-24 border-t-[1.5px] border-ink">
      <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-10 md:grid-cols-[1fr_auto] md:items-end md:px-8">
        <div className="flex max-w-[60ch] flex-col gap-3">
          <p className="meta">{copy.brand.name}</p>
          <p className="text-body text-ink-muted">{copy.colophon.statement}</p>
          <p className="meta text-ink-faint">{copy.colophon.set}</p>
        </div>
        <p className="flex gap-4 meta">
          <Link href="/archive">{copy.nav.archive}</Link>
          <Link href="/drops">{copy.nav.drops}</Link>
          <Link href="/admin" className="text-ink-faint">
            {copy.colophon.staff}
          </Link>
        </p>
      </div>
    </footer>
  );
}
