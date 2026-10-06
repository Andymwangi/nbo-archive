/*
  A hang-tag: punched string hole, mono uppercase text, slightly heavier left edge where the
  tag is folded. Used for roles, statuses and grades.
*/
type Tone = "ink" | "signal" | "tag" | "faint";

const tones: Record<Tone, string> = {
  ink: "border-ink text-ink",
  signal: "border-signal text-signal",
  tag: "border-tag text-tag",
  faint: "border-ink-faint text-ink-faint",
};

export function Tag({ children, tone = "ink" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-tag border border-l-[3px] py-0.5 pr-2 pl-1.5 meta ${tones[tone]}`}
    >
      <span aria-hidden className="size-1.5 rounded-hole border border-current" />
      {children}
    </span>
  );
}
