import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { ReleaseHoldForm } from "@/components/archive/HoldControls";
import { HoldTimer } from "@/components/archive/HoldTimer";
import { PageHeader } from "@/components/layout/PageHeader";
import { copy } from "@/content/copy";
import { formatKes, minutesUntil } from "@/lib/format";
import { currentHolds, holdsEnabled } from "@/lib/visitor";

export const metadata: Metadata = {
  title: copy.hold.page.title,
  robots: { index: false, follow: false },
};

/*
  Signature moment: the hold ledger reads like a cloakroom rail of claim tickets. Each line is a
  ticket stub with the piece's number, its photo and its own clock. Module 5 turns this page into
  checkout.
*/
export default async function HoldPage() {
  await connection();
  if (!holdsEnabled()) notFound();
  const holds = await currentHolds();
  const now = new Date();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow={copy.hold.page.eyebrow}
        title={copy.hold.page.title}
        meta={holds.length ? copy.hold.page.count(holds.length) : undefined}
      />

      {holds.length === 0 ? (
        <section className="flex flex-col items-start gap-4 py-8">
          <h2 className="font-display text-title">{copy.hold.page.emptyTitle}</h2>
          <p className="max-w-[48ch] text-lead text-ink-muted">{copy.hold.page.emptyBody}</p>
          <Link href="/archive" className="inline-flex min-h-11 items-center meta">
            {copy.hold.page.browse}
          </Link>
        </section>
      ) : (
        <>
          <ol className="flex flex-col">
            {holds.map((hold) => {
              const { piece } = hold;
              const cover = piece.cover;
              return (
                <li
                  key={hold.id}
                  className="grid grid-cols-[5.5rem_1fr] gap-x-5 gap-y-4 border-b-[1.5px] border-dashed border-ink py-6 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-x-8"
                >
                  <Link
                    href={`/item/${piece.archive_no}`}
                    className="relative block aspect-[4/5] overflow-hidden border-[1.5px] border-ink bg-paper-3"
                    aria-label={`${copy.hold.page.open}: ${piece.archive_no} ${piece.title}`}
                  >
                    {cover ? (
                      <Image
                        src={cover.url}
                        alt=""
                        fill
                        sizes="7rem"
                        placeholder={cover.placeholder ? "blur" : "empty"}
                        blurDataURL={cover.placeholder || undefined}
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center p-2 text-center meta text-ink-faint">
                        {copy.piece.noPhoto}
                      </span>
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <ArchiveNumber archiveNo={piece.archive_no} />
                    <h2 className="font-display text-lead">
                      <Link href={`/item/${piece.archive_no}`}>{piece.title}</Link>
                    </h2>
                    <p className="meta text-ink-muted">
                      {piece.brand}
                      {piece.tagged_size ? ` / ${piece.tagged_size}` : ""}
                      {piece.price_kes !== null ? ` / ${formatKes(piece.price_kes)}` : ""}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-6 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:gap-2">
                    <HoldTimer
                      expiresAt={hold.expires_at}
                      serverNow={now.toISOString()}
                      fallbackMinutes={minutesUntil(hold.expires_at, now)}
                      size="small"
                    />
                    <ReleaseHoldForm holdId={hold.id} archiveNo={piece.archive_no} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="max-w-[56ch] border-l-[3px] border-ink py-1 pl-4 text-body text-ink-muted">
            {copy.hold.page.checkoutSoon}
          </p>
        </>
      )}
    </div>
  );
}
