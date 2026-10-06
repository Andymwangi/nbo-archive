/*
  Title on the left, quick actions on the right, always at the top of the page. The eyebrow
  is a catalogue path in mono; the rule underneath is a full-width inked line.
*/
type PageHeaderProps = {
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b-[1.5px] border-ink pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <p className="meta text-ink-muted">{eyebrow}</p>
        <h1 className="font-display text-display">{title}</h1>
        {meta ? <div className="text-meta text-ink-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
