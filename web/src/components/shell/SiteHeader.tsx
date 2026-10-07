"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArchiveJump } from "@/components/layout/ArchiveJump";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { copy } from "@/content/copy";
import { categoryLinks, sectionLinks } from "@/content/navigation";
import type { Theme } from "@/lib/theme";

/*
  The drop console. One working row: the wordmark (the NBO accession prefix in a stamped box, the
  rest in the display face), the three sections with a signal underline on the open one, then
  find-by-number, holds and the theme switch. Under it, the categories as a row of tags that
  scrolls sideways on a phone. On phones the sections and find move to the bottom tab bar.
*/
type SiteHeaderProps = {
  holdCount: number;
  theme: Theme;
};

function Wordmark() {
  return (
    <Link href="/" aria-label={copy.brand.name} className="flex items-center gap-1.5 no-underline">
      <span
        aria-hidden
        className="border-[1.5px] border-ink px-1 py-0.5 font-meta text-meta leading-none tracking-[0.08em]"
      >
        NBO
      </span>
      <span aria-hidden className="font-display text-title leading-none tracking-[-0.03em]">
        archive
      </span>
    </Link>
  );
}

export function SiteHeader({ holdCount, theme }: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-b-[1.5px] border-ink">
      <div className="mx-auto flex max-w-[90rem] items-center gap-6 px-4 py-3 md:px-8 md:py-4">
        <Wordmark />

        <nav aria-label={copy.nav.label} className="hidden md:block">
          <ul className="flex items-center gap-6">
            {sectionLinks.map((link) => {
              const current = link.match(pathname);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center meta underline-offset-[6px] ${
                      current
                        ? "underline decoration-signal decoration-2"
                        : "text-ink-muted no-underline hover:text-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:block">
            <ArchiveJump />
          </div>
          {holdCount > 0 ? (
            <Link
              href="/hold"
              aria-current={pathname.startsWith("/hold") ? "page" : undefined}
              className="hidden min-h-11 items-center gap-2 meta text-signal no-underline hover:underline md:inline-flex"
            >
              <span aria-hidden className="size-2 rounded-hole bg-signal" />
              {copy.hold.nav(holdCount)}
            </Link>
          ) : null}
          <ThemeToggle initial={theme} />
        </div>
      </div>

      <nav aria-label={copy.shell.categories} className="border-t border-ink/20">
        <ul className="mx-auto flex max-w-[90rem] [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-2 md:px-8 [&::-webkit-scrollbar]:hidden">
          {categoryLinks.map((link) => (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-hole border-[1.5px] border-ink/25 px-4 meta no-underline hover:border-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
