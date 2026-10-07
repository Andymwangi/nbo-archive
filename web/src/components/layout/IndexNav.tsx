"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArchiveJump } from "@/components/layout/ArchiveJump";
import { copy } from "@/content/copy";

/*
  The storefront header is a card-catalogue drawer front: the brand on a mono label, the
  sections as file tabs along the bottom edge (the open one sits forward, joined to the page),
  and the archive-number jump where the drawer pull would be. It scrolls away with the page;
  nothing floats or blurs.
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

export function IndexNav() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="border-b-[1.5px] border-ink">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 pt-4 md:px-8 md:pt-5">
        <Link href="/" className="meta text-lead tracking-[0.18em] no-underline">
          {copy.brand.name}
        </Link>
        <ArchiveJump />
      </div>
      <nav aria-label={copy.nav.label} className="mx-auto mt-4 max-w-[90rem] px-4 md:px-8">
        <ul className="-mb-[1.5px] flex gap-1">
          {tabs.map((tab) => {
            const current = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={`block border-[1.5px] border-b-0 px-3 pt-1.5 pb-2 meta no-underline sm:px-4 ${
                    current
                      ? "border-ink bg-paper"
                      : "translate-y-[3px] border-ink/40 bg-paper-2 text-ink-muted hover:text-ink"
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
    </header>
  );
}
