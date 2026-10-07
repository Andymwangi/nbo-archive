import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ActiveFilters, Pagination, SortLinks } from "@/components/archive/ArchiveControls";
import { ContactSheetGrid } from "@/components/archive/ContactSheetGrid";
import { FilterDrawer } from "@/components/archive/FilterDrawer";
import { PageHeader } from "@/components/layout/PageHeader";
import { copy } from "@/content/copy";
import {
  ARCHIVE_PAGE_SIZE,
  type PiecePage,
  archiveHref,
  countActiveFilters,
  getFacets,
  listPieces,
  parseArchiveFilters,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";

/*
  Signature moment: the contact sheet (see ContactSheetGrid) with the editor's grease-pencil
  marks left on it. Filters live in the URL; this page only reads them.
*/

export const metadata: Metadata = { title: copy.archive.title };

type SearchParams = Record<string, string | string[] | undefined>;

function currentHref(params: SearchParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      search.append(key, item);
    }
  }
  const query = search.toString();
  return query ? `/archive?${query}` : "/archive";
}

export default async function ArchivePage({ searchParams }: PageProps<"/archive">) {
  await connection();
  const params = await searchParams;
  const filters = parseArchiveFilters(params);

  // One URL per view: empty form fields, unknown values and default settings are dropped.
  const canonical = archiveHref(filters);
  if (canonical !== currentHref(params)) redirect(canonical);

  let page: PiecePage;
  try {
    page = await listPieces(filters);
  } catch (error) {
    // A page number past the end (a stale bookmark) goes back to the first page.
    if (error instanceof ApiError && error.status === 404 && filters.page > 1) {
      redirect(archiveHref({ ...filters, page: 1 }));
    }
    throw error;
  }
  const facets = await getFacets();
  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={copy.archive.eyebrow}
        title={copy.archive.title}
        meta={copy.archive.count(page.count)}
        actions={<FilterDrawer filters={filters} facets={facets} activeCount={activeCount} />}
      />
      <div className="flex flex-col gap-4">
        <SortLinks filters={filters} />
        <ActiveFilters filters={filters} />
      </div>

      {page.results.length ? (
        <ContactSheetGrid
          pieces={page.results}
          firstFrame={(filters.page - 1) * ARCHIVE_PAGE_SIZE + 1}
          now={new Date()}
          priorityCount={4}
        />
      ) : (
        <section className="flex flex-col gap-3 border-y-[1.5px] border-ink py-12">
          <h2 className="font-display text-title">{copy.archive.emptyTitle}</h2>
          <p className="max-w-[44ch] text-lead text-ink-muted">{copy.archive.emptyBody}</p>
        </section>
      )}

      <Pagination filters={filters} count={page.count} pageSize={ARCHIVE_PAGE_SIZE} />
    </div>
  );
}
