import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ContactSheetGrid } from "@/components/archive/ContactSheetGrid";
import { DropHeader } from "@/components/archive/DropHeader";
import { copy } from "@/content/copy";
import { archiveHref, listPieces, parseArchiveFilters } from "@/lib/api/catalog";
import { type Drop, getDrop } from "@/lib/api/drops";

/*
  Signature moment: the sealed drawer. Before release the page shows the register entry, its
  clock, and how many pieces are filed inside, but not the pieces. At the release time the
  drawer opens to the full contact sheet, claimed pieces included, as the record of the batch.
*/

const DROP_SHEET_SIZE = 96;

function dropNumber(raw: string): number | null {
  return /^\d{1,6}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

async function load(raw: string): Promise<Drop> {
  const number = dropNumber(raw);
  if (number === null) notFound();
  const drop = await getDrop(number);
  if (!drop) notFound();
  return drop;
}

export async function generateMetadata({
  params,
}: PageProps<"/drops/[number]">): Promise<Metadata> {
  const number = dropNumber((await params).number);
  const drop = number === null ? null : await getDrop(number);
  if (!drop) return { title: copy.system.notFoundTitle };
  return {
    title: `${copy.drops.number(drop.number)}: ${drop.title}`,
    description: drop.intro || copy.drops.pieces(drop.piece_count),
  };
}

export default async function DropPage({ params }: PageProps<"/drops/[number]">) {
  await connection();
  const drop = await load((await params).number);
  const now = new Date();
  // The cached drop can lag the clock by up to a minute; the release time is what counts.
  const open =
    drop.released || (drop.release_at !== null && Date.parse(drop.release_at) <= now.getTime());

  const filters = { ...parseArchiveFilters({}), drop: drop.number, includeClaimed: true };
  const pieces = open ? await listPieces({ ...filters, sort: "number" }, DROP_SHEET_SIZE) : null;

  return (
    <div className="flex flex-col gap-10">
      <DropHeader drop={{ ...drop, released: open }} />

      {!open ? (
        <section className="flex flex-col gap-3 border-[1.5px] border-dashed border-ink p-6 md:p-8">
          <h2 className="font-display text-title">{copy.drops.sealedTitle(drop.piece_count)}</h2>
          <p className="max-w-[48ch] text-lead text-ink-muted">{copy.drops.sealedBody}</p>
        </section>
      ) : pieces && pieces.results.length ? (
        <>
          <ContactSheetGrid pieces={pieces.results} now={now} priorityCount={4} />
          {pieces.count > pieces.results.length ? (
            <Link href={archiveHref({ ...filters, sort: "number" })} className="meta">
              {copy.home.browse}
            </Link>
          ) : null}
        </>
      ) : (
        <p className="text-lead text-ink-muted">{copy.drops.emptyReleased}</p>
      )}
    </div>
  );
}
