"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { Icon } from "@/components/primitives/Icon";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import type { PieceCard } from "@/lib/api/catalog";
import { formatKes } from "@/lib/format";

/*
  A product carousel shoppers know how to use: cards that snap into place, square arrow buttons
  over the edges on wide screens, a thin progress bar showing how far along you are, and swipe
  on a phone. Every card is the same 4:5 print in the same border.
*/
export function ArrivalRail({ pieces, label }: { pieces: PieceCard[]; label: string }) {
  const rail = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const measure = () => {
      const scrollable = element.scrollWidth - element.clientWidth;
      setProgress(scrollable > 0 ? element.scrollLeft / scrollable : 1);
      setVisible(element.scrollWidth > 0 ? element.clientWidth / element.scrollWidth : 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, []);

  function step(direction: 1 | -1) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  }

  const thumb = Math.min(1, Math.max(visible, 0.12));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ol
          ref={rail}
          aria-label={label}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-4 overflow-x-auto px-4 md:-mx-8 md:scroll-px-8 md:gap-6 md:px-8 [&::-webkit-scrollbar]:hidden"
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
        <EdgeButton side="left" label={copy.home.railPrevious} onClick={() => step(-1)} />
        <EdgeButton side="right" label={copy.home.railNext} onClick={() => step(1)} />
      </div>
      <div aria-hidden className="relative h-[3px] bg-ink/15">
        <div
          className="absolute inset-y-0 bg-ink transition-[left] duration-[var(--dur-quick)]"
          style={{ width: `${thumb * 100}%`, left: `${progress * (1 - thumb) * 100}%` }}
        />
      </div>
    </div>
  );
}

function EdgeButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-[calc((100%-4.5rem)/2)] hidden size-11 -translate-y-1/2 place-items-center border-[1.5px] border-ink bg-paper hover:bg-ink hover:text-paper md:grid ${
        side === "left" ? "-left-2" : "-right-2"
      }`}
    >
      <Icon name={side === "left" ? "arrow-left" : "arrow-right"} size={20} />
    </button>
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
