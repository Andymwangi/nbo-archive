import Link from "next/link";

import { FormNote } from "@/components/form/Field";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { currentAdmin } from "@/lib/session";

export default async function DeskPage({ searchParams }: PageProps<"/admin">) {
  const [{ user }, { denied }] = await Promise.all([currentAdmin(), searchParams]);
  const rooms =
    user.role === "owner"
      ? [{ href: "/admin/staff", label: copy.desk.staffRoom, note: copy.desk.staffRoomNote }]
      : [];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow={copy.desk.eyebrow}
        title={copy.desk.greeting(user.name)}
        meta={
          <>
            {copy.desk.signedInAs} <span className="font-meta">{user.email}</span>
          </>
        }
      />

      {denied ? <FormNote tone="error">{copy.desk.denied}</FormNote> : null}

      <section aria-labelledby="rooms" className="flex flex-col gap-4">
        <h2 id="rooms" className="meta text-ink-muted">
          {copy.desk.sectionsTitle}
        </h2>
        {rooms.length ? (
          <ol className="border-t border-ink">
            {rooms.map((room, index) => (
              <li key={room.href} className="border-b border-ink">
                <Link
                  href={room.href}
                  className="group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 py-5 no-underline"
                >
                  <span className="font-meta text-meta text-ink-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-title group-hover:underline">
                      {room.label}
                    </span>
                    <span className="text-meta text-ink-muted">{room.note}</span>
                  </span>
                  <Icon name="arrow-right" size={22} />
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="border-[1.5px] border-dashed border-ink-faint p-5">
          <p className="font-display text-lead">{copy.desk.nothingYetTitle}</p>
          <p className="text-meta text-ink-muted">{copy.desk.nothingYetBody}</p>
        </div>
      </section>
    </div>
  );
}
