import Image from "next/image";
import Link from "next/link";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { Button } from "@/components/primitives/Button";
import { copy } from "@/content/copy";
import type { PieceCard } from "@/lib/api/catalog";
import { formatKes } from "@/lib/format";

/*
  The front page opens the way shoppers expect a fashion shop to: big photographs, one plain
  headline, one button. The photographs are the two newest pieces themselves, each wearing its
  archive-number sticker like a price ticket, so the hero changes every time something is filed
  and every photo leads to a real piece. The headline sits on an ink label rather than over a
  fade, so it reads on any photo.
*/
export function HomeHero({ pieces }: { pieces: PieceCard[] }) {
  const shown = pieces.slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <section
      aria-labelledby="hero-title"
      className={`relative grid gap-2 md:gap-3 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}
    >
      {shown.map((piece, index) => (
        <HeroPhoto key={piece.archive_no} piece={piece} first={index === 0} />
      ))}
      <div className="surface-ink absolute inset-x-3 bottom-3 flex flex-col items-start gap-3 p-5 sm:inset-x-auto sm:left-5 sm:max-w-[28rem] md:bottom-8 md:left-8 md:p-7">
        <h1 id="hero-title" className="font-display text-display">
          {copy.home.heroTitle}
        </h1>
        <p className="meta text-ink-muted">{copy.home.heroCategories}</p>
        <Button asChild variant="signal" icon="arrow-right" className="mt-1">
          <Link href="/archive" className="no-underline">
            {copy.home.heroCta}
          </Link>
        </Button>
      </div>
    </section>
  );
}

function HeroPhoto({ piece, first }: { piece: PieceCard; first: boolean }) {
  const cover = piece.cover;
  return (
    <Link
      href={`/item/${piece.archive_no}`}
      aria-label={`${piece.archive_no} ${piece.title}`}
      className={`relative block h-[78dvh] max-h-[46rem] min-h-[28rem] overflow-hidden border-[1.5px] border-ink bg-paper-3 ${
        first ? "" : "hidden md:block"
      }`}
    >
      {cover ? (
        <Image
          src={cover.url}
          alt=""
          fill
          priority={first}
          sizes="(min-width: 48rem) 50vw, 100vw"
          placeholder={cover.placeholder ? "blur" : "empty"}
          blurDataURL={cover.placeholder || undefined}
          className="object-cover"
        />
      ) : null}
      <span className="absolute top-3 left-3 flex items-center gap-3 bg-paper px-2.5 py-1.5 md:top-5 md:left-5">
        <ArchiveNumber archiveNo={piece.archive_no} />
        {piece.price_kes !== null && piece.status === "live" ? (
          <span className="font-meta text-meta tabular-nums">{formatKes(piece.price_kes)}</span>
        ) : null}
      </span>
    </Link>
  );
}
