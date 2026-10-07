import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { copy } from "@/content/copy";
import { contactDetails } from "@/lib/contact";

export const metadata: Metadata = {
  title: copy.pages.contactTitle,
  description: copy.pages.contactLede,
};

/* Only details the owner has configured are shown; nothing here is ever a placeholder. */
export default function ContactPage() {
  const contact = contactDetails();
  const rows: { label: string; value: string; href?: string; external?: boolean }[] = [];
  if (contact.whatsapp) {
    rows.push({
      label: copy.pages.whatsapp,
      value: contact.whatsapp.display,
      href: contact.whatsapp.href,
      external: true,
    });
  }
  if (contact.email) {
    rows.push({ label: copy.pages.email, value: contact.email.display, href: contact.email.href });
  }
  if (contact.instagram) {
    rows.push({
      label: copy.pages.instagram,
      value: contact.instagram.display,
      href: contact.instagram.href,
      external: true,
    });
  }
  if (contact.city) rows.push({ label: copy.pages.city, value: contact.city });
  if (contact.hours) rows.push({ label: copy.pages.hours, value: contact.hours });

  const onlyInstagram = Boolean(contact.instagram) && !contact.whatsapp && !contact.email;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow={copy.pages.contactTitle}
        title={copy.pages.contactTitle}
        meta={copy.pages.contactLede}
      />
      {onlyInstagram || rows.length === 0 ? (
        <p className="max-w-[60ch] border-l-[3px] border-ink py-1 pl-4 text-body text-ink-muted">
          {rows.length ? copy.pages.contactPending : copy.pages.contactNothing}
        </p>
      ) : null}
      {rows.length ? (
        <dl className="flex max-w-[60ch] flex-col border-t-[1.5px] border-ink">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[7rem_1fr] items-baseline gap-4 border-b border-ink/25 py-4"
            >
              <dt className="meta text-ink-muted">{row.label}</dt>
              <dd className="font-display text-lead">
                {row.href ? (
                  <a
                    href={row.href}
                    {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
