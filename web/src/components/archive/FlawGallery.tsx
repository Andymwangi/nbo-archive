import Image from "next/image";

import { copy } from "@/content/copy";
import type { ArchiveImage, Flaw } from "@/lib/api/catalog";

/*
  Flaws are shown, not hidden in small print: each one is numbered like an exhibit, with its
  close-up beside the note. An inspected piece with nothing to declare says so plainly.
*/
export function FlawGallery({ flaws, images }: { flaws: Flaw[]; images: ArchiveImage[] }) {
  const byId = new Map(images.map((image) => [image.id, image]));
  return (
    <section aria-labelledby="flaws-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="flaws-title" className="font-display text-title">
          {copy.item.flawsTitle}
        </h2>
        <p className="max-w-[52ch] text-meta text-ink-muted">{copy.item.flawsLede}</p>
      </div>
      {flaws.length === 0 ? (
        <p className="border-y border-ink/25 py-3 text-body">{copy.item.noFlaws}</p>
      ) : (
        <ol className="flex flex-col">
          {flaws.map((flaw, index) => {
            const image = flaw.image_id === null ? undefined : byId.get(flaw.image_id);
            return (
              <li
                key={flaw.id}
                className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-3 border-t border-ink/25 py-4 sm:grid-cols-[2.5rem_1fr_9rem]"
              >
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-hole border-[1.5px] border-signal font-meta text-meta text-signal"
                >
                  {index + 1}
                </span>
                <p className="self-center text-body">{flaw.description}</p>
                {image ? (
                  <a
                    href={image.url}
                    className="relative col-start-2 block aspect-square w-36 overflow-hidden border-[1.5px] border-ink bg-paper-3 sm:col-start-3 sm:row-start-1 sm:w-auto"
                  >
                    <Image
                      src={image.url}
                      alt={image.alt_text || flaw.description}
                      fill
                      sizes="9rem"
                      placeholder={image.placeholder ? "blur" : "empty"}
                      blurDataURL={image.placeholder || undefined}
                      className="object-cover"
                    />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
