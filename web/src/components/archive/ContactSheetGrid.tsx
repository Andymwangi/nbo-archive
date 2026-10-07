import Image from "next/image";
import Link from "next/link";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { ClaimedStamp } from "@/components/archive/ClaimedStamp";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import type { PieceCard } from "@/lib/api/catalog";
import { formatKes, pad2 } from "@/lib/format";

/*
  A photographer's contact sheet, not a product grid. Frames keep their order and their
  numbers, every print is the same 4:5 size in the same ink border so rows line up, and the
  editor's grease pencil is left on the sheet: new frames are circled, claimed frames are
  crossed through and stamped. Nothing scales on hover; the sheet is read, not played with.
*/

const NEW_FOR_DAYS = 7;

function isNew(publishedAt: string | null, now: Date): boolean {
  if (!publishedAt) return false;
  const age = now.getTime() - Date.parse(publishedAt);
  return age >= 0 && age < NEW_FOR_DAYS * 86_400_000;
}

type ContactSheetGridProps = {
  pieces: PieceCard[];
  /** Number printed beside the first frame; later frames count on from it. */
  firstFrame?: number;
  now: Date;
  /** Above-the-fold sheets load their first row eagerly. */
  priorityCount?: number;
};

export function ContactSheetGrid({
  pieces,
  firstFrame = 1,
  now,
  priorityCount = 0,
}: ContactSheetGridProps) {
  return (
    <ol className="grid grid-cols-2 items-start gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {pieces.map((piece, index) => (
        <li key={piece.archive_no}>
          <Frame
            piece={piece}
            frame={firstFrame + index}
            circled={isNew(piece.published_at, now)}
            priority={index < priorityCount}
          />
        </li>
      ))}
    </ol>
  );
}

function Frame({
  piece,
  frame,
  circled,
  priority,
}: {
  piece: PieceCard;
  frame: number;
  circled: boolean;
  priority: boolean;
}) {
  const claimed = piece.status === "claimed";
  const cover = piece.cover;
  return (
    <Link
      href={`/item/${piece.archive_no}`}
      className="group flex flex-col gap-2 no-underline outline-offset-4"
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={`grid min-w-8 place-items-center px-1 meta tabular-nums ${
            circled
              ? "rounded-hole border-[1.5px] border-signal py-0.5 text-signal"
              : "text-ink-faint"
          }`}
          aria-hidden
        >
          {pad2(frame)}
        </span>
        <ArchiveNumber archiveNo={piece.archive_no} />
      </span>

      <span className="relative block aspect-[4/5] overflow-hidden border-[1.5px] border-ink bg-paper-3">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt_text || piece.title}
            fill
            sizes="(min-width: 64rem) 25vw, (min-width: 48rem) 33vw, 50vw"
            placeholder={cover.placeholder ? "blur" : "empty"}
            blurDataURL={cover.placeholder || undefined}
            priority={priority}
            className={`object-cover ${claimed ? "opacity-70 grayscale-[35%]" : ""}`}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center p-4 text-center meta text-ink-faint">
            {copy.piece.noPhoto}
          </span>
        )}
        {claimed ? (
          <>
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full text-signal"
            >
              <path
                d="M6 8 L94 92 M94 6 L7 93"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center">
              <ClaimedStamp className="bg-paper/85" />
            </span>
          </>
        ) : null}
      </span>

      <span className="flex flex-col gap-1">
        <span className="text-body leading-snug group-hover:underline">{piece.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <FramePrice piece={piece} />
          {piece.chest_band ? (
            <span className="meta text-ink-muted">{copy.labels.chestBand[piece.chest_band]}</span>
          ) : null}
          {piece.is_placeholder ? <Tag tone="faint">{copy.piece.sample}</Tag> : null}
        </span>
      </span>
    </Link>
  );
}

function FramePrice({ piece }: { piece: PieceCard }) {
  if (piece.status === "claimed") {
    return <span className="meta text-signal">{copy.piece.claimed}</span>;
  }
  if (piece.status === "held") {
    return <Tag tone="signal">{copy.piece.held}</Tag>;
  }
  return (
    <span className="font-meta text-meta tabular-nums">
      {piece.price_kes === null ? copy.piece.priceToCome : formatKes(piece.price_kes)}
    </span>
  );
}
