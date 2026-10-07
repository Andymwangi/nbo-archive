import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FlawList } from "@/app/admin/(desk)/accessions/[id]/FlawList";
import { PhotoManager } from "@/app/admin/(desk)/accessions/[id]/PhotoManager";
import { PieceActions } from "@/app/admin/(desk)/accessions/[id]/PieceActions";
import {
  DetailsForm,
  DropForm,
  ExtrasForm,
  MeasurementsForm,
} from "@/app/admin/(desk)/accessions/[id]/PieceForms";
import { PieceStatusTag } from "@/components/admin/StatusTag";
import { FormNote } from "@/components/form/Field";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/primitives/Icon";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { getAdminPiece, listAdminDrops, lockedStatuses } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";

type Props = PageProps<"/admin/accessions/[id]">;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) notFound();
  return id;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { access } = await requireRole(["owner", "editor", "packer"]);
  const piece = await getAdminPiece(access, parseId(id));
  return { title: piece ? piece.archive_no : copy.accessionsDesk.title };
}

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-t-[1.5px] border-ink pt-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-display text-title">
          {title}
        </h2>
        {lede ? <p className="text-meta text-ink-muted">{lede}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function PiecePage({ params }: Props) {
  const [{ id }, { user, access }] = await Promise.all([
    params,
    requireRole(["owner", "editor", "packer"]),
  ]);
  const piece = await getAdminPiece(access, parseId(id));
  if (!piece) notFound();

  const writer = user.role !== "packer";
  const locked = lockedStatuses.includes(piece.status);
  const readOnly = !writer || locked;
  const drops = writer && !locked ? (await listAdminDrops(access, 1, 96)).results : [];
  const problems = Object.entries(piece.problems);
  const sections = copy.pieceDesk.sections;

  return (
    <div className="flex flex-col gap-10">
      <Link
        href="/admin/accessions"
        className="inline-flex min-h-11 items-center gap-2 self-start meta"
      >
        <Icon name="arrow-left" size={16} />
        {copy.pieceDesk.back}
      </Link>

      <PageHeader
        eyebrow={`${copy.accessionsDesk.eyebrow} / ${piece.archive_no}`}
        title={piece.title || copy.accessionsDesk.untitled}
        meta={
          <span className="flex flex-wrap items-center gap-3">
            <PieceStatusTag status={piece.status} />
            {piece.is_placeholder ? <Tag tone="faint">{copy.accessionsDesk.sample}</Tag> : null}
            {piece.status === "scheduled" && piece.release_at ? (
              <span>{copy.pieceDesk.releaseAt(formatDateTime(piece.release_at))}</span>
            ) : null}
            {piece.status === "live" && piece.published_at ? (
              <span>{copy.pieceDesk.publishedAt(formatDateTime(piece.published_at))}</span>
            ) : null}
            {piece.created_by ? <span>{copy.pieceDesk.createdBy(piece.created_by)}</span> : null}
          </span>
        }
        actions={<PieceActions piece={piece} readOnly={readOnly} />}
      />

      {locked ? (
        <FormNote tone="error">{copy.pieceDesk.locked(copy.pieceStatus[piece.status])}</FormNote>
      ) : null}
      {!writer ? <p className="text-meta text-ink-muted">{copy.pieceDesk.readOnly}</p> : null}
      {piece.is_placeholder ? (
        <p className="text-meta text-ink-muted">{copy.pieceDesk.sampleNote}</p>
      ) : null}

      <section
        aria-labelledby="problems"
        className={`flex flex-col gap-3 border-l-[3px] py-1 pl-4 ${problems.length ? "border-signal" : "border-tag"}`}
      >
        <h2 id="problems" className="meta">
          {problems.length ? copy.pieceDesk.problemsTitle : copy.pieceDesk.problemsReady}
        </h2>
        {problems.length ? (
          <ul className="flex flex-col gap-1 text-body">
            {problems.map(([field, reasons]) => (
              <li key={field}>
                <span className="font-meta text-meta uppercase">
                  {copy.pieceDesk.problemField[field] ?? field}
                </span>{" "}
                {reasons.join(" ")}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Section id="label" title={sections.label}>
        <DetailsForm piece={piece} readOnly={readOnly} />
      </Section>

      <Section id="measurements" title={sections.measurements} lede={sections.measurementsLede}>
        <MeasurementsForm piece={piece} readOnly={readOnly} />
      </Section>

      <Section id="extras" title={`${sections.extras}: ${copy.labels.category[piece.category]}`}>
        <ExtrasForm piece={piece} readOnly={readOnly} />
      </Section>

      <Section id="photos" title={sections.photos}>
        <PhotoManager piece={piece} readOnly={readOnly} />
      </Section>

      <Section id="flaws" title={sections.flaws} lede={sections.flawsLede}>
        <FlawList piece={piece} readOnly={readOnly} />
      </Section>

      <Section id="drop" title={sections.drop}>
        <DropForm piece={piece} readOnly={readOnly || piece.status === "scheduled"} drops={drops} />
      </Section>
    </div>
  );
}
