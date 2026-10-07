import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";

/*
  The archive-number jump: the way a regular finds a piece they saw on Instagram. It is a plain
  GET form to /jump, which resolves any spelling (142, 0142, NBO-0142) and redirects to the
  record, so it works before JavaScript loads and with it off.
*/
export function ArchiveJump() {
  return (
    <form action="/jump" method="get" role="search" className="flex items-stretch">
      <label className="flex items-stretch border-[1.5px] border-r-0 border-ink bg-paper-2 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-ink focus-within:outline-dashed">
        <span className="sr-only">{copy.nav.jumpLabel}</span>
        <span
          aria-hidden
          className="grid place-items-center pl-3 font-meta text-meta text-ink-faint"
        >
          NBO-
        </span>
        <input
          name="no"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="go"
          maxLength={12}
          required
          placeholder={copy.nav.jumpPlaceholder}
          className="w-[6.5ch] bg-transparent py-2 pr-2 pl-0.5 font-meta text-meta tabular-nums placeholder:text-ink-faint/70 focus-visible:outline-none"
        />
      </label>
      <button
        type="submit"
        className="grid min-h-11 min-w-11 place-items-center bg-ink px-2 text-paper focus-visible:outline-offset-2"
      >
        <Icon name="search" size={18} />
        <span className="sr-only">{copy.nav.jumpSubmit}</span>
      </button>
    </form>
  );
}
