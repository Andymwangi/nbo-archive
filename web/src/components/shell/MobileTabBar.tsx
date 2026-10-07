"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ArchiveJump } from "@/components/layout/ArchiveJump";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon, type IconName } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import {
  archiveLinks,
  categoryLinks,
  helpLinks,
  legalLinks,
  type NavLink,
  sectionLinks,
} from "@/content/navigation";

/*
  On a phone the main controls sit under the thumb: Shop, Find (by archive number), Holds (or
  Drops while holds are closed) and Menu. It is hidden from md up, where the header carries them.
*/
type MobileTabBarProps = {
  holdCount: number;
  holdsOpen: boolean;
};

const tabClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 meta no-underline";

export function MobileTabBar({ holdCount, holdsOpen }: MobileTabBarProps) {
  const pathname = usePathname() ?? "/";
  const [panel, setPanel] = useState<"find" | "menu" | null>(null);
  const close = () => setPanel(null);

  const tab = (href: string, label: string, icon: IconName, active: boolean, badge?: number) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${tabClass} ${active ? "text-ink" : "text-ink-muted"}`}
    >
      <span className="relative">
        <Icon name={icon} size={22} />
        {badge ? (
          <span className="absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-hole bg-signal px-1 text-[0.625rem] leading-4 text-signal-ink">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </Link>
  );

  return (
    <>
      <nav
        aria-label={copy.nav.label}
        className="fixed inset-x-0 bottom-0 z-30 border-t-[1.5px] border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex">
          {tab(
            "/archive",
            copy.shell.tabs.shop,
            "grid",
            pathname.startsWith("/archive") || pathname.startsWith("/item"),
          )}
          <button
            type="button"
            onClick={() => setPanel("find")}
            className={`${tabClass} text-ink-muted`}
          >
            <Icon name="search" size={22} />
            {copy.shell.tabs.find}
          </button>
          {holdsOpen
            ? tab("/hold", copy.shell.tabs.holds, "clock", pathname.startsWith("/hold"), holdCount)
            : tab("/drops", copy.shell.tabs.drops, "calendar", pathname.startsWith("/drops"))}
          <button
            type="button"
            onClick={() => setPanel("menu")}
            className={`${tabClass} text-ink-muted`}
          >
            <Icon name="menu" size={22} />
            {copy.shell.tabs.menu}
          </button>
        </div>
      </nav>

      <Drawer
        open={panel === "find"}
        onOpenChange={(open) => setPanel(open ? "find" : null)}
        title={copy.shell.findTitle}
        description={copy.shell.findLede}
      >
        <ArchiveJump />
      </Drawer>

      <Drawer
        open={panel === "menu"}
        onOpenChange={(open) => setPanel(open ? "menu" : null)}
        title={copy.shell.menuTitle}
      >
        <div className="flex flex-col gap-8">
          <MenuGroup
            title={copy.footer.groups.shop}
            onNavigate={close}
            links={[
              ...sectionLinks,
              ...(holdsOpen ? [{ href: "/hold", label: copy.footer.links.holds }] : []),
            ]}
          />
          <MenuGroup title={copy.shell.categories} links={categoryLinks} onNavigate={close} />
          <MenuGroup
            title={copy.footer.groups.help}
            links={helpLinks(holdsOpen)}
            onNavigate={close}
          />
          <MenuGroup
            title={copy.footer.groups.archive}
            links={[...archiveLinks, ...legalLinks]}
            onNavigate={close}
          />
        </div>
      </Drawer>
    </>
  );
}

function MenuGroup({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: NavLink[];
  onNavigate: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="meta text-ink-muted">{title}</h3>
      <ul className="flex flex-col border-t border-ink/20">
        {links.map((link) => (
          <li key={link.href} className="border-b border-ink/20">
            <Link
              href={link.href}
              onClick={onNavigate}
              className="flex min-h-12 items-center justify-between text-lead no-underline"
            >
              {link.label}
              <Icon name="arrow-right" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
