import Link from "next/link";

import { DropListForm } from "@/components/shell/DropListForm";
import { NairobiClock } from "@/components/shell/NairobiClock";
import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { archiveLinks, helpLinks, legalLinks } from "@/content/navigation";
import type { Drop } from "@/lib/api/drops";
import { type ContactDetails, contactDetails } from "@/lib/contact";
import { formatDateTime } from "@/lib/format";

/*
  The footer is the back of the drawer: a solid ink block that leads with the drop list, then
  every link a shopper expects (shop, help, the archive, legal), the facts that build trust
  (how to pay, where we deliver, how to reach us, the time in Nairobi, the next drop), and the
  wordmark set wide enough to run off the page. On a phone the link groups fold into accordions.
*/

type FooterLink = { href: string; label: string; external?: boolean };
type FooterGroup = { title: string; links: FooterLink[] };

function groups(holdsOpen: boolean, contact: ContactDetails): FooterGroup[] {
  const l = copy.footer.links;
  return [
    {
      title: copy.footer.groups.shop,
      links: [
        { href: "/", label: l.latest },
        { href: "/archive", label: l.archive },
        { href: "/drops", label: l.drops },
        ...(holdsOpen ? [{ href: "/hold", label: l.holds }] : []),
      ],
    },
    { title: copy.footer.groups.help, links: helpLinks(holdsOpen) },
    {
      title: copy.footer.groups.archive,
      links: [
        ...archiveLinks,
        ...(contact.instagram
          ? [{ href: contact.instagram.href, label: contact.instagram.display, external: true }]
          : []),
      ],
    },
    { title: copy.footer.groups.legal, links: legalLinks },
  ];
}

function LinkList({ links }: { links: FooterLink[] }) {
  return (
    <ul className="flex flex-col">
      {links.map((link) => (
        <li key={link.href}>
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 text-body no-underline hover:underline"
            >
              {link.label}
              <Icon name="arrow-right" size={14} className="-rotate-45" />
            </a>
          ) : (
            <Link
              href={link.href}
              className="inline-flex min-h-10 items-center text-body no-underline hover:underline"
            >
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

type SiteFooterProps = {
  holdsOpen: boolean;
  nextDrop: Drop | null;
  now: Date;
};

export function SiteFooter({ holdsOpen, nextDrop, now }: SiteFooterProps) {
  const contact = contactDetails();
  const linkGroups = groups(holdsOpen, contact);
  const visit = [contact.city, contact.hours].filter(Boolean).join(" / ");

  return (
    <footer className="surface-ink mt-24 overflow-hidden">
      <div className="mx-auto grid max-w-[90rem] gap-14 px-4 pt-14 pb-10 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pt-20">
        <section id="drop-list" aria-labelledby="drop-list-title" className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="meta text-ink-muted">{copy.shell.strip.label}</p>
            <h2 id="drop-list-title" className="font-display text-display">
              {copy.footer.listTitle}
            </h2>
            <p className="max-w-[46ch] text-body text-ink-muted">{copy.footer.listLede}</p>
          </div>
          <DropListForm />
        </section>

        <nav aria-label="Footer">
          <div className="hidden gap-8 md:grid md:grid-cols-4">
            {linkGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <h2 className="meta text-ink-muted">{group.title}</h2>
                <LinkList links={group.links} />
              </div>
            ))}
          </div>
          <div className="border-t border-ink/30 md:hidden">
            {linkGroups.map((group) => (
              <details key={group.title} className="group border-b border-ink/30">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between meta [&::-webkit-details-marker]:hidden">
                  {group.title}
                  <Icon
                    name="chevron-down"
                    size={18}
                    className="transition-transform duration-[var(--dur-base)] group-open:rotate-180"
                  />
                </summary>
                <div className="pb-4">
                  <LinkList links={group.links} />
                </div>
              </details>
            ))}
          </div>
        </nav>
      </div>

      <div className="mx-auto max-w-[90rem] px-4 md:px-8">
        <dl className="grid gap-x-8 gap-y-5 border-t border-ink/30 py-6 text-meta sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="meta text-ink-muted">{copy.footer.visit}</dt>
            <dd className="flex flex-col gap-0.5">
              {visit ? <span>{visit}</span> : null}
              {contact.whatsapp ? (
                <a href={contact.whatsapp.href} target="_blank" rel="noopener noreferrer">
                  {copy.pages.whatsapp} {contact.whatsapp.display}
                </a>
              ) : null}
              {contact.email ? <a href={contact.email.href}>{contact.email.display}</a> : null}
              {!visit && !contact.whatsapp && !contact.email ? (
                <Link href="/contact">{copy.footer.links.contact}</Link>
              ) : null}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="meta text-ink-muted">{copy.footer.pay}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="border border-ink/50 px-2 py-0.5 font-meta text-meta">
                {copy.footer.payMpesa}
              </span>
              <span>{copy.footer.delivery}</span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="meta text-ink-muted">{copy.footer.nairobiTime}</dt>
            <dd className="font-meta">
              <NairobiClock serverNow={now.toISOString()} />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="meta text-ink-muted">{copy.drops.next}</dt>
            <dd>
              {nextDrop?.release_at ? (
                <Link href={`/drops/${nextDrop.number}`}>
                  {copy.shell.strip.nextDrop(
                    String(nextDrop.number).padStart(2, "0"),
                    formatDateTime(nextDrop.release_at),
                  )}
                </Link>
              ) : (
                <Link href="#drop-list">{copy.footer.listTitle}</Link>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <p
        aria-hidden
        className="mx-auto max-w-[90rem] px-2 font-display text-[clamp(4rem,18vw,17rem)] leading-[0.78] tracking-[-0.05em] whitespace-nowrap select-none md:px-6"
      >
        nboarchive
      </p>

      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-4 py-6 meta text-ink-muted md:px-8">
        <span>&copy; {copy.footer.rights(now.getFullYear())}</span>
        <Link href="/admin" className="text-ink-muted">
          {copy.footer.staff}
        </Link>
      </div>
    </footer>
  );
}
