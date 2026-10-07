import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NewPiece } from "@/app/admin/(desk)/accessions/NewPiece";
import { PieceStatusTag } from "@/components/admin/StatusTag";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { listAdminPieces, type PieceStatus, pieceStatuses } from "@/lib/api/admin";
import { type Category, categories } from "@/lib/api/catalog";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime, formatKes } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: copy.accessionsDesk.title };

const control = "min-h-12 w-full border-0 border-b-[1.5px] border-ink bg-transparent";

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function listHref(filters: { status: string; category: string; q: string }, page: number) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.category) query.set("category", filters.category);
  if (filters.q) query.set("q", filters.q);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/admin/accessions?${search}` : "/admin/accessions";
}

export default async function AccessionsPage({ searchParams }: PageProps<"/admin/accessions">) {
  const [{ user, access }, params] = await Promise.all([
    requireRole(["owner", "editor", "packer"]),
    searchParams as Promise<Params>,
  ]);
  const canWrite = user.role !== "packer";

  const rawStatus = one(params.status);
  const rawCategory = one(params.category);
  const status = (pieceStatuses as readonly string[]).includes(rawStatus)
    ? (rawStatus as PieceStatus)
    : "";
  const category = (categories as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "";
  const q = one(params.q).slice(0, 80);
  const requested = Number(one(params.page) || 1);
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1;
  const filters = { status, category, q };

  let pieces;
  try {
    pieces = await listAdminPieces(access, {
      page,
      status: status ? [status] : undefined,
      category: category ? [category] : undefined,
      q: q || undefined,
    });
  } catch (error) {
    // A page past the end (pieces deleted, a stale link) falls back to the first page.
    if (isApiError(error) && error.status === 404 && page > 1) redirect(listHref(filters, 1));
    throw error;
  }
  const filtered = Boolean(status || category || q);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={copy.accessionsDesk.eyebrow}
        title={copy.accessionsDesk.title}
        meta={copy.accessionsDesk.count(pieces.count)}
        actions={canWrite ? <NewPiece /> : null}
      />

      <form
        action="/admin/accessions"
        className="grid gap-4 border-b border-ink-faint pb-6 sm:grid-cols-2 lg:grid-cols-[12rem_12rem_minmax(0,1fr)_auto]"
      >
        <label className="flex flex-col gap-1.5">
          <span className="meta text-ink-muted">{copy.accessionsDesk.statusLabel}</span>
          <select
            name="status"
            defaultValue={status}
            className={`${control} font-meta text-meta uppercase`}
          >
            <option value="">{copy.accessionsDesk.anyStatus}</option>
            {pieceStatuses.map((value) => (
              <option key={value} value={value}>
                {copy.pieceStatus[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="meta text-ink-muted">{copy.accessionsDesk.categoryLabel}</span>
          <select
            name="category"
            defaultValue={category}
            className={`${control} font-meta text-meta uppercase`}
          >
            <option value="">{copy.accessionsDesk.anyCategory}</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {copy.labels.category[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="meta text-ink-muted">{copy.accessionsDesk.searchLabel}</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={80}
            placeholder={copy.accessionsDesk.searchHint}
            className={`${control} text-body`}
          />
        </label>
        <div className="flex items-end gap-4">
          <Button type="submit" variant="stamp" icon="search" iconPosition="start">
            {copy.accessionsDesk.apply}
          </Button>
          {filtered ? (
            <Link href="/admin/accessions" className="inline-flex min-h-12 items-center meta">
              {copy.accessionsDesk.clear}
            </Link>
          ) : null}
        </div>
      </form>

      <div>
        <div
          aria-hidden
          className="hidden grid-cols-[4rem_minmax(0,1fr)_8rem_8rem_10rem] gap-5 border-b border-ink pb-2 meta text-ink-muted md:grid"
        >
          <span />
          <span>{copy.accessionsDesk.columns.piece}</span>
          <span>{copy.accessionsDesk.columns.status}</span>
          <span>{copy.accessionsDesk.columns.price}</span>
          <span>{copy.accessionsDesk.columns.updated}</span>
        </div>
        {pieces.results.length ? (
          <ul>
            {pieces.results.map((piece) => (
              <li key={piece.id} className="border-b border-ink-faint">
                <Link
                  href={`/admin/accessions/${piece.id}`}
                  className="group grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-5 gap-y-2 py-4 no-underline md:grid-cols-[4rem_minmax(0,1fr)_8rem_8rem_10rem]"
                >
                  <span className="relative row-span-2 block aspect-[4/5] w-16 overflow-hidden bg-paper-2 md:row-span-1">
                    {piece.cover ? (
                      <Image
                        src={piece.cover.url}
                        alt=""
                        fill
                        sizes="4rem"
                        placeholder={piece.cover.placeholder ? "blur" : "empty"}
                        blurDataURL={piece.cover.placeholder || undefined}
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-meta text-meta text-ink-muted">{piece.archive_no}</span>
                    <span className="truncate font-display text-lead group-hover:underline">
                      {piece.title || copy.accessionsDesk.untitled}
                    </span>
                    <span className="text-meta text-ink-muted">
                      {copy.labels.category[piece.category]}
                      {piece.brand ? ` / ${piece.brand}` : ""} /{" "}
                      {copy.accessionsDesk.photos(piece.image_count)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <PieceStatusTag status={piece.status} />
                    {piece.is_placeholder ? (
                      <Tag tone="faint">{copy.accessionsDesk.sample}</Tag>
                    ) : null}
                  </span>
                  <span className="font-meta text-meta">
                    {piece.price_kes !== null
                      ? formatKes(piece.price_kes)
                      : copy.accessionsDesk.noPrice}
                  </span>
                  <span className="text-meta text-ink-muted">
                    {formatDateTime(piece.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-meta text-ink-muted">
            {filtered ? copy.accessionsDesk.emptyFiltered : copy.accessionsDesk.empty}
          </p>
        )}
      </div>

      {pieces.previous || pieces.next ? (
        <nav aria-label="Pages" className="flex justify-between">
          {pieces.previous ? (
            <Link
              className="inline-flex min-h-11 items-center meta"
              href={listHref(filters, page - 1)}
            >
              {copy.accessionsDesk.previous}
            </Link>
          ) : (
            <span />
          )}
          {pieces.next ? (
            <Link
              className="inline-flex min-h-11 items-center meta"
              href={listHref(filters, page + 1)}
            >
              {copy.accessionsDesk.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
