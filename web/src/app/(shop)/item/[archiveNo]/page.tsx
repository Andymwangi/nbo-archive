import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { ClaimedStamp } from "@/components/archive/ClaimedStamp";
import { ContactSheetGrid } from "@/components/archive/ContactSheetGrid";
import { FlawGallery } from "@/components/archive/FlawGallery";
import { LabelCard } from "@/components/archive/LabelCard";
import { MeasurementTable } from "@/components/archive/MeasurementTable";
import { PhotoSheet } from "@/components/archive/PhotoSheet";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { type Piece, getPiece } from "@/lib/api/catalog";
import { canonicalArchiveNo } from "@/lib/archive-no";
import { formatDate, formatKes } from "@/lib/format";

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
  const piece = await load(archiveNo);

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
            <StatusSlot piece={piece} />
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
  Where "Place on hold" will go (Module 4). Until holds exist it states where the piece stands
  instead of offering a button that does nothing.
*/
function StatusSlot({ piece }: { piece: Piece }) {
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
  if (piece.status === "held") {
    return (
      <section className="flex flex-col items-start gap-3 border-[1.5px] border-signal p-5">
        <Tag tone="signal">{copy.piece.held}</Tag>
        <p className="text-body">{copy.item.heldNote}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col items-start gap-3 border-[1.5px] border-dashed border-ink p-5">
      <Tag>{copy.item.onRail}</Tag>
      <p className="text-body text-ink-muted">{copy.item.holdsSoon}</p>
    </section>
  );
}
