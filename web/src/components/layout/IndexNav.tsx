"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArchiveJump } from "@/components/layout/ArchiveJump";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { copy } from "@/content/copy";
import type { Theme } from "@/lib/theme";

/*
  The storefront header is a card-catalogue drawer front: the brand on a mono label, the sections
  as small file tabs standing on the bottom rule (the open one sits forward, joined to the page),
  and the archive-number jump where the drawer pull would be. On wide screens it is one row; on a
  phone the tabs and the jump share a second row. It scrolls away with the page; nothing floats.
*/
const tabs = [
  { href: "/", label: copy.nav.latest, match: (path: string) => path === "/" },
  {
    href: "/archive",
    label: copy.nav.archive,
    match: (path: string) => path.startsWith("/archive") || path.startsWith("/item"),
  },
  { href: "/drops", label: copy.nav.drops, match: (path: string) => path.startsWith("/drops") },
];

type IndexNavProps = {
  holdCount: number;
  theme: Theme;
};

export function IndexNav({ holdCount, theme }: IndexNavProps) {
  const pathname = usePathname() ?? "/";
  const onHoldPage = pathname.startsWith("/hold");

  return (
    <header className="border-b-[1.5px] border-ink">
      <div className="mx-auto grid max-w-[90rem] grid-cols-[1fr_auto] items-center gap-x-4 px-4 md:grid-cols-[auto_1fr_auto_auto] md:gap-x-6 md:px-8">
        <Link
          href="/"
          className="col-start-1 row-start-1 py-3 meta text-lead tracking-[0.18em] no-underline"
        >
          {copy.brand.name}
        </Link>

        <nav
          aria-label={copy.nav.label}
          className="col-start-1 row-start-2 self-end md:col-start-2 md:row-start-1"
        >
          <ul className="-mb-[1.5px] flex gap-1">
            {tabs.map((tab) => {
              const current = tab.match(pathname);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex min-h-10 items-center border-[1.5px] border-b-0 px-2.5 meta no-underline sm:px-3 ${
                      current
                        ? "border-ink bg-paper"
                        : "translate-y-[2px] border-ink/40 bg-paper-2 text-ink-muted hover:text-ink"
                    }`}
                    style={current ? { boxShadow: "0 1.5px 0 0 var(--paper)" } : undefined}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 md:col-start-3">
          {holdCount > 0 ? (
            <Link
              href="/hold"
              aria-current={onHoldPage ? "page" : undefined}
              className="inline-flex min-h-11 items-center gap-2 meta text-signal no-underline hover:underline"
            >
              <span aria-hidden className="size-2 rounded-hole bg-signal" />
              {copy.hold.nav(holdCount)}
            </Link>
          ) : null}
          <ThemeToggle initial={theme} />
        </div>

        <div className="col-start-2 row-start-2 py-2 md:col-start-4 md:row-start-1">
          <ArchiveJump />
        </div>
      </div>
    </header>
  );
}
