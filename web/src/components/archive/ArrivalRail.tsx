"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { Icon } from "@/components/primitives/Icon";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import type { PieceCard } from "@/lib/api/catalog";
import { formatKes } from "@/lib/format";

/*
  The newest pieces on a rail you can swipe: every card the same 4:5 print in the same border,
  snapping into place one at a time. Arrow buttons step through it on wider screens; on a phone
  the thumb does. The first card is the page's main image, so it loads first.
*/
export function ArrivalRail({ pieces, label }: { pieces: PieceCard[]; label: string }) {
  const rail = useRef<HTMLOListElement>(null);

  function step(direction: 1 | -1) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <ol
        ref={rail}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] gap-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:scroll-px-8 md:gap-6 md:px-8"
      >
        {pieces.map((piece, index) => (
          <li
            key={piece.archive_no}
            className="w-[68vw] shrink-0 snap-start sm:w-[40vw] lg:w-[19rem]"
          >
            <RailCard piece={piece} priority={index === 0} />
          </li>
        ))}
      </ol>
      <div className="mt-2 hidden justify-end gap-2 md:flex">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={copy.home.railPrevious}
          className="grid size-11 place-items-center border-[1.5px] border-ink hover:bg-paper-2"
        >
          <Icon name="arrow-left" size={20} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={copy.home.railNext}
          className="grid size-11 place-items-center border-[1.5px] border-ink hover:bg-paper-2"
        >
          <Icon name="arrow-right" size={20} />
        </button>
      </div>
    </div>
  );
}

function RailCard({ piece, priority }: { piece: PieceCard; priority: boolean }) {
  const cover = piece.cover;
  return (
    <Link href={`/item/${piece.archive_no}`} className="group flex flex-col gap-3 no-underline">
      <span className="relative block aspect-[4/5] overflow-hidden border-[1.5px] border-ink bg-paper-3">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt_text || piece.title}
            fill
            priority={priority}
            sizes="(min-width: 64rem) 19rem, (min-width: 40rem) 40vw, 68vw"
            placeholder={cover.placeholder ? "blur" : "empty"}
            blurDataURL={cover.placeholder || undefined}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center p-4 text-center meta text-ink-faint">
            {copy.piece.noPhoto}
          </span>
        )}
        <span className="absolute top-0 left-0 bg-paper px-2 py-1">
          <ArchiveNumber archiveNo={piece.archive_no} />
        </span>
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-body leading-snug group-hover:underline">{piece.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 meta text-ink-muted">
          {piece.status === "held" ? (
            <Tag tone="signal">{copy.piece.held}</Tag>
          ) : (
            <span className="font-meta text-meta text-ink tabular-nums">
              {piece.price_kes === null ? copy.piece.priceToCome : formatKes(piece.price_kes)}
            </span>
          )}
          {piece.chest_band ? <span>{copy.labels.chestBand[piece.chest_band]}</span> : null}
          {piece.condition_grade ? (
            <span>{copy.labels.condition[piece.condition_grade]}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
