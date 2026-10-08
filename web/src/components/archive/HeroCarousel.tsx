"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { Button } from "@/components/primitives/Button";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import type { PieceCard } from "@/lib/api/catalog";
import { formatKes } from "@/lib/format";

/*
  The front page opens on a slideshow of the newest pieces, the way shoppers expect a fashion
  shop to, kept in the archive's terms: every slide is a real piece wearing its archive-number
  sticker, and each new photograph is revealed by a wipe, like a print pulled from under the
  last. The headline and the one shop button stay put while the pieces change.

  It moves on by itself every six seconds, and stops whenever someone is looking closely: on
  hover, on keyboard focus, after a touch, while the tab is hidden, when paused with the button,
  and always when the visitor has asked for reduced motion. Screen readers hear each slide only
  when the visitor moves it themselves, never while it plays on its own.
*/

const INTERVAL_MS = 6000;
const SWIPE_THRESHOLD = 40;

function subscribeReducedMotion(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // The server cannot know; assume stillness so nothing moves before the client decides.
    () => true,
  );
}

type Move = {
  index: number;
  /** The slide being covered by the wipe, kept visible underneath it. */
  previous: number | null;
  direction: "forward" | "back";
  byVisitor: boolean;
};

export function HeroCarousel({ pieces }: { pieces: PieceCard[] }) {
  const slides = pieces.filter((piece) => piece.cover).slice(0, 5);
  const count = slides.length;
  const reducedMotion = useReducedMotion();
  const [move, setMove] = useState<Move>({
    index: 0,
    previous: null,
    direction: "forward",
    byVisitor: false,
  });
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const pointerStart = useRef<number | null>(null);

  const playing = count > 1 && !paused && !holding && !reducedMotion;

  function go(index: number, direction: Move["direction"], byVisitor: boolean) {
    setMove((current) => ({
      index: (index + count) % count,
      previous: current.index,
      direction,
      byVisitor,
    }));
  }

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setMove((current) => ({
        index: (current.index + 1) % count,
        previous: current.index,
        direction: "forward",
        byVisitor: false,
      }));
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, count]);

  if (count === 0) return null;
  const active = slides[move.index] ?? slides[0]!;

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby="hero-title"
      className="relative"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(move.index + 1, "forward", true);
        if (event.key === "ArrowLeft") go(move.index - 1, "back", true);
      }}
    >
      <div
        className="relative h-[78dvh] max-h-[46rem] min-h-[28rem] touch-pan-y overflow-hidden border-[1.5px] border-ink bg-paper-3"
        onPointerDown={(event) => {
          pointerStart.current = event.clientX;
          if (event.pointerType !== "mouse") setPaused(true);
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (start === null || count < 2) return;
          const distance = event.clientX - start;
          if (Math.abs(distance) < SWIPE_THRESHOLD) return;
          if (distance < 0) go(move.index + 1, "forward", true);
          else go(move.index - 1, "back", true);
        }}
      >
        {slides.map((piece, index) => {
          const isActive = index === move.index;
          const isPrevious = index === move.previous && !isActive;
          return (
            <div
              key={piece.archive_no}
              role="group"
              aria-roledescription="slide"
              aria-label={copy.home.slideLabel(index + 1, count)}
              aria-hidden={!isActive}
              data-direction={move.direction}
              className={`absolute inset-0 ${
                isActive
                  ? `z-10 ${move.previous !== null ? "hero-slide-enter" : ""}`
                  : isPrevious
                    ? "z-0"
                    : "invisible z-0"
              }`}
            >
              <Image
                src={piece.cover!.url}
                alt={piece.cover!.alt_text || piece.title}
                fill
                priority={index === 0}
                sizes="100vw"
                placeholder={piece.cover!.placeholder ? "blur" : "empty"}
                blurDataURL={piece.cover!.placeholder || undefined}
                className="object-cover"
                draggable={false}
              />
            </div>
          );
        })}

        <Link
          href={`/item/${active.archive_no}`}
          className="absolute top-3 left-3 z-20 flex items-center gap-3 bg-paper px-2.5 py-1.5 no-underline md:top-5 md:left-5"
        >
          <ArchiveNumber archiveNo={active.archive_no} />
          {active.price_kes !== null && active.status === "live" ? (
            <span className="font-meta text-meta tabular-nums">{formatKes(active.price_kes)}</span>
          ) : null}
        </Link>

        <div className="surface-ink absolute inset-x-3 bottom-3 z-20 flex flex-col items-start gap-3 p-5 sm:inset-x-auto sm:left-5 sm:max-w-[28rem] md:bottom-8 md:left-8 md:p-7">
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

        <div className="absolute right-5 bottom-8 z-20 hidden max-w-[20rem] flex-col items-start gap-2 bg-paper p-4 md:flex">
          <p className="text-body leading-snug">{active.title}</p>
          <Link
            href={`/item/${active.archive_no}`}
            className="inline-flex min-h-11 items-center gap-2 meta"
          >
            {copy.home.viewPiece}
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(move.index - 1, "back", true)}
              aria-label={copy.home.previousPiece}
              className="absolute top-1/2 left-3 z-20 hidden size-11 -translate-y-1/2 place-items-center border-[1.5px] border-ink bg-paper hover:bg-ink hover:text-paper md:grid"
            >
              <Icon name="arrow-left" size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(move.index + 1, "forward", true)}
              aria-label={copy.home.nextPiece}
              className="absolute top-1/2 right-3 z-20 hidden size-11 -translate-y-1/2 place-items-center border-[1.5px] border-ink bg-paper hover:bg-ink hover:text-paper md:grid"
            >
              <Icon name="arrow-right" size={20} />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-between gap-4 pt-3">
          <div className="flex items-center gap-1">
            {slides.map((piece, index) => (
              <button
                key={piece.archive_no}
                type="button"
                onClick={() => go(index, index >= move.index ? "forward" : "back", true)}
                aria-label={copy.home.showSlide(index + 1)}
                aria-current={index === move.index ? "true" : undefined}
                className="grid size-11 place-items-center"
              >
                <span
                  aria-hidden
                  className={`block h-[3px] transition-[width,background-color] duration-[var(--dur-base)] ${
                    index === move.index ? "w-8 bg-ink" : "w-4 bg-ink/25"
                  }`}
                />
              </button>
            ))}
          </div>
          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
              className="inline-flex min-h-11 items-center gap-2 meta"
            >
              <Icon name={paused ? "play" : "pause"} size={18} />
              {paused ? copy.home.playSlides : copy.home.pauseSlides}
            </button>
          ) : null}
        </div>
      ) : null}

      <p aria-live={move.byVisitor ? "polite" : "off"} className="sr-only">
        {move.byVisitor ? `${active.archive_no} ${active.title}` : ""}
      </p>
    </section>
  );
}
