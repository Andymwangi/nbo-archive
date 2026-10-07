import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DropCountdown } from "@/components/archive/DropCountdown";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { listDrops } from "@/lib/api/drops";
import { formatDateTime } from "@/lib/format";

/*
  Signature moment: the accessions ledger. Each release is one ruled line in a register, its
  number set large in the margin like a hand-numbered entry; an upcoming one carries its clock
  on the same line.
*/

export const metadata: Metadata = { title: copy.drops.title };

export default async function DropsPage() {
  await connection();
  const { results: drops } = await listDrops();
  const now = new Date();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow={copy.drops.eyebrow} title={copy.drops.title} meta={copy.drops.lede} />
      {drops.length === 0 ? (
        <section className="flex flex-col gap-3 py-8">
          <h2 className="font-display text-title">{copy.drops.emptyTitle}</h2>
          <p className="max-w-[44ch] text-lead text-ink-muted">{copy.drops.emptyBody}</p>
        </section>
      ) : (
        <ol className="flex flex-col">
          {drops.map((drop) => {
            const open =
              drop.released ||
              (drop.release_at !== null && Date.parse(drop.release_at) <= now.getTime());
            return (
              <li
                key={drop.number}
                className="grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-3 border-b border-ink/30 py-6 md:grid-cols-[7rem_1fr_auto] md:items-center md:gap-x-8"
              >
                <p
                  aria-hidden
                  className={`font-display text-display tabular-nums ${
                    open ? "text-ink" : "text-signal"
                  }`}
                >
                  {String(drop.number).padStart(2, "0")}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="meta text-ink-muted">{copy.drops.number(drop.number)}</p>
                  <h2 className="font-display text-title">
                    <Link href={`/drops/${drop.number}`}>{drop.title}</Link>
                  </h2>
                  <p className="meta text-ink-muted">
                    {open
                      ? drop.release_at
                        ? copy.drops.released(formatDateTime(drop.release_at))
                        : null
                      : drop.release_at
                        ? copy.drops.opensAt(formatDateTime(drop.release_at))
                        : copy.drops.unscheduled}
                    {" / "}
                    {copy.drops.pieces(drop.piece_count)}
                  </p>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-4 md:col-span-1 md:justify-end">
                  {!open && drop.release_at ? (
                    <DropCountdown
                      releaseAt={drop.release_at}
                      fallback={copy.drops.opensAt(formatDateTime(drop.release_at))}
                      size="small"
                    />
                  ) : null}
                  <Link
                    href={`/drops/${drop.number}`}
                    className="inline-flex min-h-11 items-center gap-2 meta"
                    aria-label={`${copy.drops.view}: ${copy.drops.number(drop.number)}`}
                  >
                    {copy.drops.view}
                    <Icon name="arrow-right" size={18} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
