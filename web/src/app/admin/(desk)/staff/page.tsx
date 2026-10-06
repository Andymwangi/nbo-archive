import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AddStaff } from "@/app/admin/(desk)/staff/AddStaff";
import { StaffRow } from "@/app/admin/(desk)/staff/StaffRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { copy } from "@/content/copy";
import { listAdmins } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: copy.staff.title };

export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const [{ user, access }, params] = await Promise.all([requireRole(["owner"]), searchParams]);
  const requested = Number(params.page ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1;
  if (String(page) !== String(params.page ?? 1)) redirect("/admin/staff");

  let staff;
  try {
    staff = await listAdmins(access, page);
  } catch (error) {
    // A page past the end (staff were removed, or a stale link) is not an error worth a crash.
    if (isApiError(error) && error.status === 404 && page > 1) redirect("/admin/staff");
    throw error;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={copy.staff.eyebrow}
        title={copy.staff.title}
        meta={copy.staff.count(staff.count)}
        actions={<AddStaff />}
      />

      <div>
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1fr)_14rem_10rem] gap-6 border-b border-ink pb-2 meta text-ink-muted md:grid"
        >
          <span>{copy.staff.columns.person}</span>
          <span>{copy.staff.columns.role}</span>
          <span>{copy.staff.columns.lastSeen}</span>
        </div>
        <ul>
          {staff.results.map((member) => (
            <StaffRow key={member.id} member={member} isSelf={member.id === user.id} />
          ))}
        </ul>
        {staff.count <= 1 ? (
          <p className="py-6 text-meta text-ink-muted">{copy.staff.empty}</p>
        ) : null}
      </div>

      {staff.previous || staff.next ? (
        <nav aria-label="Pages" className="flex justify-between">
          {staff.previous ? (
            <Link
              className="inline-flex min-h-11 items-center meta"
              href={`/admin/staff?page=${page - 1}`}
            >
              {copy.staff.previous}
            </Link>
          ) : (
            <span />
          )}
          {staff.next ? (
            <Link
              className="inline-flex min-h-11 items-center meta"
              href={`/admin/staff?page=${page + 1}`}
            >
              {copy.staff.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
