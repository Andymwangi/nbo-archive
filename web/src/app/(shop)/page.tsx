import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { ContactSheetGrid } from "@/components/archive/ContactSheetGrid";
import { DropCountdown } from "@/components/archive/DropCountdown";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { listPieces, parseArchiveFilters } from "@/lib/api/catalog";
import { nextDrop } from "@/lib/api/drops";
import { formatDate, formatDateTime, formatKes } from "@/lib/format";

/*
  Signature moment: the front page is the accession register opened at its last entry. The
  newest piece's number is set at wall-label scale beside its photograph, as if it had just
  been stencilled on. No hero banner, no slogan.
*/

const RECENT = 8;

export default async function LatestPage() {
  await connection();
  const now = new Date();
  const [recent, upcoming] = await Promise.all([
    listPieces(parseArchiveFilters({}), RECENT + 1),
    nextDrop(now),
  ]);
  const [latest, ...earlier] = recent.results;

  if (!latest) {
    return (
      <section className="flex min-h-[50dvh] flex-col justify-center gap-4">
        <p className="meta text-ink-muted">{copy.home.eyebrow}</p>
        <h1 className="max-w-[18ch] font-display text-display">{copy.home.emptyTitle}</h1>
        <p className="max-w-[44ch] text-lead text-ink-muted">{copy.home.emptyBody}</p>
      </section>
    );
  }

  const cover = latest.cover;
  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <article className="grid gap-8 lg:grid-cols-[minmax(0,min(50%,calc(70dvh*0.8)))_minmax(0,1fr)] lg:items-end lg:gap-12">
        <div className="flex flex-col gap-4 lg:order-2">
          <p className="meta text-ink-muted">{copy.home.eyebrow}</p>
          <ArchiveNumber archiveNo={latest.archive_no} size="display" as="p" className="-ml-0.5" />
          <h1 className="max-w-[18ch] font-display text-title">{latest.title}</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 meta text-ink-muted">
            <span>{copy.labels.category[latest.category]}</span>
            {latest.brand ? <span>{latest.brand}</span> : null}
            {latest.era ? <span>{latest.era}</span> : null}
            {latest.published_at ? (
              <span>{copy.home.filed(formatDate(latest.published_at))}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            {latest.status === "live" && latest.price_kes !== null ? (
              <span className="inline-block -rotate-2 bg-signal px-3 py-1.5 font-meta text-lead text-signal-ink tabular-nums">
                {formatKes(latest.price_kes)}
              </span>
            ) : null}
            {latest.status === "held" ? <Tag tone="signal">{copy.piece.held}</Tag> : null}
            {latest.is_placeholder ? <Tag tone="faint">{copy.piece.sample}</Tag> : null}
          </div>
          <div className="pt-2">
            <Button asChild icon="arrow-right">
              <Link href={`/item/${latest.archive_no}`} className="no-underline">
                {copy.home.open}
              </Link>
            </Button>
          </div>
        </div>
        <Link
          href={`/item/${latest.archive_no}`}
          className="relative block aspect-[4/5] max-h-[70dvh] overflow-hidden border-[1.5px] border-ink bg-paper-3 max-lg:mx-auto max-lg:w-full max-lg:max-w-[calc(70dvh*0.8)] lg:order-1"
        >
          {cover ? (
            <Image
              src={cover.url}
              alt={cover.alt_text || latest.title}
              fill
              priority
              sizes="(min-width: 64rem) 50vw, 100vw"
              placeholder={cover.placeholder ? "blur" : "empty"}
              blurDataURL={cover.placeholder || undefined}
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center meta text-ink-faint">
              {copy.piece.noPhoto}
            </span>
          )}
        </Link>
      </article>

      {upcoming?.release_at ? (
        <section
          aria-labelledby="next-drop"
          className="grid gap-6 border-y-[1.5px] border-ink py-6 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="flex flex-col gap-2">
            <p className="meta text-ink-muted">
              {copy.drops.next} / {copy.drops.number(upcoming.number)}
            </p>
            <h2 id="next-drop" className="font-display text-title">
              <Link href={`/drops/${upcoming.number}`}>{upcoming.title}</Link>
            </h2>
            <p className="meta text-ink-muted">
              {copy.drops.opensAt(formatDateTime(upcoming.release_at))} /{" "}
              {copy.drops.pieces(upcoming.piece_count)}
            </p>
          </div>
          <DropCountdown
            releaseAt={upcoming.release_at}
            fallback={copy.drops.opensAt(formatDateTime(upcoming.release_at))}
            size="small"
          />
        </section>
      ) : null}

      {earlier.length ? (
        <section aria-labelledby="recent" className="flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3">
            <h2 id="recent" className="font-display text-title">
              {copy.home.recentTitle}
            </h2>
            <Link href="/archive" className="meta">
              {copy.home.browse}
            </Link>
          </div>
          <ContactSheetGrid pieces={earlier} firstFrame={2} now={now} />
        </section>
      ) : null}
    </div>
  );
}
