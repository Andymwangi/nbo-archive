import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { ClaimedStamp } from "@/components/archive/ClaimedStamp";
import { ContactSheetGrid } from "@/components/archive/ContactSheetGrid";
import { FlawGallery } from "@/components/archive/FlawGallery";
import { PlaceHoldForm, ReleaseHoldForm } from "@/components/archive/HoldControls";
import { HoldTimer } from "@/components/archive/HoldTimer";
import { LabelCard } from "@/components/archive/LabelCard";
import { MeasurementTable } from "@/components/archive/MeasurementTable";
import { PhotoSheet } from "@/components/archive/PhotoSheet";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { type Piece, getPiece } from "@/lib/api/catalog";
import type { Hold } from "@/lib/api/holds";
import { canonicalArchiveNo } from "@/lib/archive-no";
import { formatDate, formatKes, minutesUntil } from "@/lib/format";
import { currentHolds, holdsEnabled } from "@/lib/visitor";

/*
  Signature moment: the record reads like a museum object file. The archive number is set at
  wall-label scale, the label card carries the facts, and flaws are numbered exhibits with their
  own close-ups. Claimed pieces keep their whole record under the stamp.
*/

async function load(raw: string): Promise<Piece> {
  // Next hands over params already decoded; decoding again would be a double decode.
  const archiveNo = canonicalArchiveNo(raw);
  if (!archiveNo) notFound();
  if (archiveNo !== raw) permanentRedirect(`/item/${archiveNo}`);
  const piece = await getPiece(archiveNo);
  if (!piece) notFound();
  return piece;
}

export async function generateMetadata({
  params,
}: PageProps<"/item/[archiveNo]">): Promise<Metadata> {
  const { archiveNo } = await params;
  const canonical = canonicalArchiveNo(archiveNo);
  const piece = canonical ? await getPiece(canonical) : null;
  if (!piece) return { title: copy.system.notFoundTitle };

  const price =
    piece.status === "claimed" || piece.price_kes === null ? "" : `, ${formatKes(piece.price_kes)}`;
  const description = [
    `${piece.brand} ${copy.labels.category[piece.category].toLowerCase()}`,
    `tagged ${piece.tagged_size}`,
    piece.measurements.chest ? `${piece.measurements.chest} cm chest` : "",
    piece.condition_grade ? copy.labels.condition[piece.condition_grade].toLowerCase() : "",
  ]
    .filter(Boolean)
    .join(", ");
  const cover = piece.images.find((image) => image.kind === "front") ?? piece.images[0];
  return {
    title: `${piece.archive_no} ${piece.title}`,
    description: `${description}${price}.`,
    alternates: { canonical: `/item/${piece.archive_no}` },
    openGraph: {
      title: `${piece.archive_no} ${piece.title}`,
      description: `${description}${price}.`,
      images: cover ? [{ url: cover.url, width: cover.width, height: cover.height }] : undefined,
    },
    robots: piece.is_placeholder ? { index: false } : undefined,
  };
}

export default async function ItemPage({ params }: PageProps<"/item/[archiveNo]">) {
  await connection();
  const { archiveNo } = await params;
  const [piece, holds] = await Promise.all([load(archiveNo), currentHolds()]);
  const mine = holds.find((hold) => hold.piece.archive_no === piece.archive_no);

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <article className="flex flex-col gap-10">
        <header className="flex flex-col gap-3 border-b-[1.5px] border-ink pb-6">
          <p className="meta text-ink-muted">
            {copy.item.eyebrow} / {copy.labels.category[piece.category]}
          </p>
          <h1 className="flex flex-col gap-3">
            <ArchiveNumber archiveNo={piece.archive_no} size="numeral" className="-ml-1" />
            <span className="sr-only">{piece.title}</span>
          </h1>
          {piece.is_placeholder ? (
            <p className="flex max-w-[60ch] flex-wrap items-center gap-3 text-meta text-ink-muted">
              <Tag tone="faint">{copy.piece.sample}</Tag>
              {copy.piece.sampleNote}
            </p>
          ) : null}
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <PhotoSheet images={piece.images} title={piece.title} />
          <div className="flex flex-col gap-10 lg:sticky lg:top-8 lg:self-start">
            <LabelCard piece={piece} />
            <StatusSlot piece={piece} mine={mine} holdsOpen={holdsEnabled()} now={new Date()} />
            {piece.status !== "claimed" ? <DeliveryNote holdsOpen={holdsEnabled()} /> : null}
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          <MeasurementTable measurements={piece.measurements} />
          <FlawGallery flaws={piece.flaws} images={piece.images} />
        </div>

        {piece.provenance_note ? (
          <section aria-labelledby="provenance" className="flex max-w-[64ch] flex-col gap-3">
            <h2 id="provenance" className="font-display text-title">
              {copy.item.provenanceTitle}
            </h2>
            <p className="text-lead whitespace-pre-line text-ink-muted">{piece.provenance_note}</p>
          </section>
        ) : null}
      </article>

      {piece.related.length ? (
        <section aria-labelledby="related" className="flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3">
            <h2 id="related" className="font-display text-title">
              {copy.item.relatedTitle}
              {piece.era ? <span className="text-ink-muted">: {piece.era}</span> : null}
            </h2>
          </div>
          <ContactSheetGrid pieces={piece.related} now={new Date()} />
        </section>
      ) : null}
    </div>
  );
}

/*
  Where the piece stands, and what this visitor can do about it. The piece record is cached for a
  minute, but the visitor's own holds are read fresh, so "held for you" is always current. A piece
  shown as held whose clock has run out is treated as back on the rail: placing a hold ends the
  lapsed one on the spot.
*/
function StatusSlot({
  piece,
  mine,
  holdsOpen,
  now,
}: {
  piece: Piece;
  mine: Hold | undefined;
  holdsOpen: boolean;
  now: Date;
}) {
  if (piece.status === "claimed") {
    const claimedAt = piece.claimed?.claimed_at;
    const city = piece.claimed?.city ?? "";
    return (
      <section className="flex flex-col items-start gap-4">
        <ClaimedStamp
          variant="record"
          detail={
            claimedAt ? `${city ? `${city} / ` : ""}${formatDate(claimedAt)}` : city || undefined
          }
        />
        <p className="text-body text-ink-muted">
          {claimedAt
            ? copy.item.claimedNote(city, formatDate(claimedAt))
            : copy.item.claimedNoteUndated}
        </p>
      </section>
    );
  }

  if (mine) {
    return (
      <section
        aria-labelledby="your-hold"
        className="flex flex-col items-start gap-4 border-[1.5px] border-signal bg-paper-2 p-5"
      >
        <Tag tone="signal">
          <span id="your-hold">{copy.hold.yours}</span>
        </Tag>
        <HoldTimer
          expiresAt={mine.expires_at}
          serverNow={now.toISOString()}
          fallbackMinutes={minutesUntil(mine.expires_at, now)}
        />
        <p className="text-body text-ink-muted">{copy.hold.yoursNote}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/hold" className="inline-flex min-h-11 items-center meta">
            {copy.hold.seeHolds}
          </Link>
          <ReleaseHoldForm holdId={mine.id} archiveNo={piece.archive_no} />
        </div>
      </section>
    );
  }

  const heldMinutes =
    piece.status === "held" && piece.hold ? minutesUntil(piece.hold.expires_at, now) : null;
  if (piece.status === "held" && (heldMinutes === null || heldMinutes > 0 || !holdsOpen)) {
    return (
      <section className="flex flex-col items-start gap-3 border-[1.5px] border-signal p-5">
        <Tag tone="signal">{copy.piece.held}</Tag>
        <p className="text-body">
          {heldMinutes ? copy.hold.backIn(heldMinutes) : copy.item.heldNote}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-start gap-3 border-[1.5px] border-dashed border-ink p-5">
      <Tag>{copy.item.onRail}</Tag>
      {holdsOpen ? (
        <>
          <p className="text-body text-ink-muted">{copy.hold.placeNote}</p>
          <PlaceHoldForm archiveNo={piece.archive_no} />
        </>
      ) : (
        <p className="text-body text-ink-muted">{copy.item.holdsSoon}</p>
      )}
    </section>
  );
}

/** Lufimen-style reassurance at the moment of deciding: how to pay and where it can go. */
function DeliveryNote({ holdsOpen }: { holdsOpen: boolean }) {
  return (
    <div className="flex flex-col gap-2 border-t border-ink/25 pt-4">
      <p className="meta">{copy.hold.payDelivery}</p>
      <p className="flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/policies/shipping" className="inline-flex min-h-11 items-center meta">
          {copy.hold.howDelivery}
        </Link>
        {holdsOpen ? (
          <Link href="/help/holds" className="inline-flex min-h-11 items-center meta">
            {copy.hold.howHolds}
          </Link>
        ) : null}
      </p>
    </div>
  );
}
