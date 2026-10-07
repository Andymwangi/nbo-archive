import { PageHeader } from "@/components/layout/PageHeader";
import { Tag } from "@/components/primitives/Tag";
import { DRAFT_NOTE, type InfoPage } from "@/content/pages";
import { copy } from "@/content/copy";

/*
  The information pages read like the notes at the back of a catalogue: a numbered column of
  sections, short paragraphs, plain tables for measurements and grades. Draft policies carry a
  banner until the owner has signed them off.
*/
export function InfoPageView({ page, children }: { page: InfoPage; children?: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-10">
      <PageHeader eyebrow={page.eyebrow} title={page.title} meta={page.lede} />
      {page.draft ? (
        <p className="flex max-w-[64ch] flex-wrap items-center gap-3 border-l-[3px] border-signal py-1 pl-4 text-meta text-ink-muted">
          <Tag tone="signal">{copy.pages.draftLabel}</Tag>
          {DRAFT_NOTE}
        </p>
      ) : null}
      <ol className="flex max-w-[72ch] flex-col">
        {page.sections.map((section, index) => (
          <li
            key={section.heading}
            className="grid gap-3 border-t border-ink/25 py-7 sm:grid-cols-[4rem_1fr] sm:gap-6"
          >
            <span aria-hidden className="font-meta text-meta text-ink-faint tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-title">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-body text-ink-muted">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="flex flex-col gap-2">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-3 text-body text-ink-muted">
                      <span aria-hidden className="text-signal">
                        /
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.rows ? (
                <dl className="flex flex-col border-t border-ink/20">
                  {section.rows.map(([term, detail]) => (
                    <div
                      key={term}
                      className="grid grid-cols-[6rem_1fr] gap-4 border-b border-ink/20 py-2.5"
                    >
                      <dt className="font-meta text-meta uppercase">{term}</dt>
                      <dd className="text-body text-ink-muted">{detail}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {children}
    </article>
  );
}
