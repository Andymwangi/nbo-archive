import { splitArchiveNo } from "@/lib/archive-no";

/*
  The archive number is the piece's name. The NBO- prefix is set faint so the digits carry the
  weight, the way an accession number is stencilled on a museum crate.
    numeral -- the item record's wall-label size
    display -- the latest piece on the home page
    title   -- headings and drop pages
    meta    -- frames, labels, anywhere it is a reference rather than a name
*/
type Size = "numeral" | "display" | "title" | "meta";

const sizes: Record<Size, string> = {
  numeral: "font-display text-numeral",
  display: "font-display text-display",
  title: "font-display text-title",
  meta: "font-meta text-meta tracking-[0.04em]",
};

type ArchiveNumberProps = {
  archiveNo: string;
  size?: Size;
  as?: "span" | "p" | "h1" | "h2";
  className?: string;
};

export function ArchiveNumber({
  archiveNo,
  size = "meta",
  as: Element = "span",
  className = "",
}: ArchiveNumberProps) {
  const { prefix, digits } = splitArchiveNo(archiveNo);
  return (
    <Element className={`tabular-nums ${sizes[size]} ${className}`}>
      <span className="sr-only">{archiveNo}</span>
      {prefix ? (
        <span aria-hidden className={size === "numeral" ? "text-ink-faint/60" : "text-ink-faint"}>
          {prefix}
        </span>
      ) : null}
      <span aria-hidden>{digits}</span>
    </Element>
  );
}
