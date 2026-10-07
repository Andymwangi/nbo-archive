import Link from "next/link";

import { ArchiveNumber } from "@/components/archive/ArchiveNumber";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import type { Piece } from "@/lib/api/catalog";
import { formatDate, formatKes } from "@/lib/format";

/*
  The museum wall label for a garment: label stock, a punched corner, every fact on its own
  ruled line in the order a buyer checks them. The price is a stuck-on sticker in signal ink,
  the one place the label raises its voice.
*/
export function LabelCard({ piece }: { piece: Piece }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: copy.item.brand, value: piece.brand },
    {
      label: copy.item.taggedSize,
      value: (
        <>
          {piece.tagged_size}
          {piece.chest_band ? (
            <span className="text-ink-muted">
              {" "}
              / {copy.item.fitsLike(copy.labels.chestBand[piece.chest_band])}
            </span>
          ) : null}
        </>
      ),
    },
    { label: copy.item.colour, value: piece.colour },
    { label: copy.item.fabric, value: piece.fabric_composition },
    ...(piece.era ? [{ label: copy.item.era, value: piece.era }] : []),
    ...Object.entries(piece.category_extras)
      .filter(([, value]) => value)
      .map(([key, value]) => ({ label: copy.labels.extras[key] ?? key, value })),
    ...(piece.fit_note ? [{ label: copy.item.fit, value: piece.fit_note }] : []),
    ...(piece.drop
      ? [
          {
            label: copy.item.drop,
            value: (
              <Link href={`/drops/${piece.drop.number}`}>
                {copy.drops.number(piece.drop.number)}
                {piece.drop.title ? `, ${piece.drop.title}` : ""}
              </Link>
            ),
          },
        ]
      : []),
  ];

  return (
    <section
      aria-labelledby="label-title"
      className="relative border-[1.5px] border-ink bg-paper-2 px-5 pt-5 pb-6 sm:px-7"
    >
      <span
        aria-hidden
        className="absolute top-4 right-4 size-3 rounded-hole border-[1.5px] border-ink bg-paper"
      />
      <div className="flex flex-col gap-1 pr-8">
        <p className="meta text-ink-muted">
          {copy.labels.category[piece.category]} / <ArchiveNumber archiveNo={piece.archive_no} />
        </p>
        <h2 id="label-title" className="font-display text-title">
          {piece.title}
        </h2>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {piece.status !== "claimed" ? (
          <span className="inline-block -rotate-2 bg-signal px-3 py-1.5 font-meta text-lead text-signal-ink tabular-nums">
            {piece.price_kes === null ? copy.piece.priceToCome : formatKes(piece.price_kes)}
          </span>
        ) : null}
        {piece.condition_grade ? (
          <Tag>
            {copy.item.condition}: {copy.labels.condition[piece.condition_grade]}
          </Tag>
        ) : null}
        {piece.cleaned_at ? (
          <Tag tone="tag">
            {copy.item.cleaned} {formatDate(piece.cleaned_at)}
          </Tag>
        ) : null}
      </div>

      <dl className="mt-6 border-t border-ink">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 border-b border-ink/25 py-2.5"
          >
            <dt className="pt-0.5 meta text-ink-muted">{row.label}</dt>
            <dd className="text-body">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
