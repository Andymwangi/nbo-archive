/*
  A library index card: paper-2 stock, the red rule printed near the top edge, a catalogue
  number in the corner. Holds short, single-purpose forms.
*/
type IndexCardProps = {
  eyebrow: string;
  cardNo?: string;
  children: React.ReactNode;
};

export function IndexCard({ eyebrow, cardNo, children }: IndexCardProps) {
  return (
    <section className="relative border-[1.5px] border-ink bg-paper-2">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-3 sm:px-7">
        <p className="meta text-ink-muted">{eyebrow}</p>
        {cardNo ? <p className="meta text-ink-faint">{cardNo}</p> : null}
      </div>
      <div aria-hidden className="h-[2px] bg-signal" />
      <div className="flex flex-col gap-6 px-5 pt-6 pb-7 sm:px-7">{children}</div>
    </section>
  );
}
