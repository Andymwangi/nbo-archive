"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ArchiveJump } from "@/components/layout/ArchiveJump";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { mainNavLinks } from "@/content/navigation";
import type { Theme } from "@/lib/theme";

/*
  The familiar shop header, set in the archive's type: the wordmark on the left (the NBO prefix
  in a stamped box), the whole menu in the middle on wide screens with a signal underline under
  the open section, and the usual icons on the right: search (by archive number), the account
  (a dot once signed in), the holds bag with its count, and the theme switch. Below lg the menu moves to the tab bar at the bottom.
*/
type SiteHeaderProps = {
  holdCount: number;
  holdsOpen: boolean;
  signedIn: boolean;
  theme: Theme;
};

const iconButton = "relative grid size-11 shrink-0 place-items-center hover:text-ink-muted";

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

export function SiteHeader({ holdCount, holdsOpen, signedIn, theme }: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="border-b-[1.5px] border-ink">
      <div className="mx-auto grid max-w-[90rem] grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 md:px-8 lg:grid-cols-[1fr_auto_1fr] lg:py-4">
        <Wordmark />

        <nav aria-label={copy.nav.label} className="hidden lg:block">
          <ul className="flex items-center gap-1 xl:gap-3">
            {mainNavLinks.map((link) => {
              const current = link.category
                ? link.match(pathname) && activeCategory === link.category
                : link.match(pathname) && !(link.href === "/archive" && activeCategory);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center px-2 text-body underline-offset-[7px] ${
                      current
                        ? "underline decoration-signal decoration-2"
                        : "no-underline hover:underline hover:decoration-ink/30"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={copy.nav.search}
            className={iconButton}
          >
            <Icon name="search" size={22} />
          </button>
          <Link
            href={signedIn ? "/account" : "/account/sign-in"}
            aria-label={signedIn ? copy.account.yourAccount : copy.account.signIn}
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={iconButton}
          >
            <Icon name="user" size={22} />
            {signedIn ? (
              <span aria-hidden className="absolute top-2 right-2 size-2 rounded-hole bg-signal" />
            ) : null}
          </Link>
          {holdsOpen ? (
            <Link
              href="/hold"
              aria-label={copy.nav.holdsBag(holdCount)}
              aria-current={pathname.startsWith("/hold") ? "page" : undefined}
              className={`${iconButton} hidden lg:grid`}
            >
              <Icon name="bag" size={22} />
              {holdCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-hole bg-signal px-1 text-[0.625rem] leading-4 text-signal-ink"
                >
                  {holdCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          <ThemeToggle initial={theme} />
        </div>
      </div>

      <Drawer
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={copy.shell.findTitle}
        description={copy.shell.findLede}
      >
        <ArchiveJump />
      </Drawer>
    </header>
  );
}
