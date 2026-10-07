import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DropDrawer } from "@/app/admin/(desk)/drops/DropControls";
import { DropStatusTag } from "@/components/admin/StatusTag";
import { PageHeader } from "@/components/layout/PageHeader";
import { copy } from "@/content/copy";
import { listAdminDrops } from "@/lib/api/admin";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: copy.dropsDesk.title };

export default async function DropsPage({ searchParams }: PageProps<"/admin/drops">) {
  const [{ user, access }, params] = await Promise.all([
    requireRole(["owner", "editor", "packer"]),
    searchParams,
  ]);
  const writer = user.role !== "packer";
  const raw = Array.isArray(params.page) ? params.page[0] : params.page;
  const requested = Number(raw ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1;

  let drops;
  try {
    drops = await listAdminDrops(access, page);
  } catch (error) {
    if (isApiError(error) && error.status === 404 && page > 1) redirect("/admin/drops");
    throw error;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={copy.dropsDesk.eyebrow}
        title={copy.dropsDesk.title}
        meta={copy.dropsDesk.count(drops.count)}
        actions={writer ? <DropDrawer /> : null}
      />

      <div>
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1fr)_8rem_12rem_7rem_6rem] gap-5 border-b border-ink pb-2 meta text-ink-muted md:grid"
        >
          <span>{copy.dropsDesk.columns.drop}</span>
          <span>{copy.dropsDesk.columns.status}</span>
          <span>{copy.dropsDesk.columns.release}</span>
          <span>{copy.dropsDesk.columns.pieces}</span>
          <span />
        </div>
        {drops.results.length ? (
          <ul>
            {drops.results.map((drop) => (
              <li
                key={drop.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 border-b border-ink-faint py-4 md:grid-cols-[minmax(0,1fr)_8rem_12rem_7rem_6rem]"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-meta text-meta text-ink-muted">
                    {copy.dropsDesk.editTitle(String(drop.number).padStart(2, "0"))}
                  </span>
                  <span className="truncate font-display text-lead">{drop.title}</span>
                </span>
                <span>
                  <DropStatusTag status={drop.status} />
                </span>
                <span className="text-meta">
                  {drop.release_at ? formatDateTime(drop.release_at) : copy.dropsDesk.noRelease}
                </span>
                <span className="text-meta text-ink-muted">
                  {copy.dropsDesk.pieces(drop.piece_count)}
                </span>
                <span className="justify-self-end">
                  {writer ? <DropDrawer drop={drop} /> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-meta text-ink-muted">{copy.dropsDesk.empty}</p>
        )}
      </div>

      {drops.previous || drops.next ? (
        <nav aria-label="Pages" className="flex justify-between">
          {drops.previous ? (
            <Link
              className="inline-flex min-h-11 items-center meta"
              href={`/admin/drops?page=${page - 1}`}
            >
              {copy.dropsDesk.previous}
            </Link>
          ) : (
            <span />
          )}
          {drops.next ? (
            <Link
              className="inline-flex min-h-11 items-center meta"
              href={`/admin/drops?page=${page + 1}`}
            >
              {copy.dropsDesk.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
