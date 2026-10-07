import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { copy } from "@/content/copy";
import { currentAdmin } from "@/lib/session";
import { readTheme } from "@/lib/theme-server";

export const metadata: Metadata = {
  title: { default: copy.brand.backRoom, template: `%s / ${copy.brand.backRoom}` },
  robots: { index: false, follow: false },
};

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, theme] = await Promise.all([currentAdmin(), readTheme()]);
  const rooms = [
    { href: "/admin", label: "Desk" },
    { href: "/admin/accessions", label: copy.desk.accessionsRoom },
    { href: "/admin/drops", label: copy.desk.dropsRoom },
    ...(user.role === "owner" ? [{ href: "/admin/staff", label: copy.desk.staffRoom }] : []),
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b-[1.5px] border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 md:px-8">
          <Link href="/admin" className="meta no-underline">
            {copy.brand.name} / {copy.brand.backRoom}
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-meta text-ink-muted sm:inline">
              {user.name || user.email}
            </span>
            <Tag tone={user.role === "owner" ? "signal" : "ink"}>{user.role}</Tag>
            <ThemeToggle initial={theme} />
            <form action={signOutAction}>
              <Button type="submit" variant="quiet" icon="logout" className="min-h-11">
                {copy.desk.signOut}
              </Button>
            </form>
          </div>
        </div>
        <nav aria-label="Rooms" className="mx-auto max-w-6xl px-5 md:px-8">
          <ul className="-mb-[1.5px] flex gap-6">
            {rooms.map((room) => (
              <li key={room.href}>
                <Link
                  href={room.href}
                  className="inline-flex min-h-11 items-center border-b-[3px] border-transparent meta no-underline hover:border-ink-faint"
                >
                  {room.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">{children}</main>
    </div>
  );
}
