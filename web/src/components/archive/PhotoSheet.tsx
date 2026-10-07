import Image from "next/image";

import { copy } from "@/content/copy";
import type { ArchiveImage } from "@/lib/api/catalog";
import { pad2 } from "@/lib/format";

/*
  Every photograph of the piece, in the order the owner set, each captioned with what it shows
  (front, brand tag, care label). No carousel: nothing is hidden behind a swipe, and it works
  with JavaScript off. The first print runs large; the rest pair up beneath it.
*/
export function PhotoSheet({ images, title }: { images: ArchiveImage[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="grid aspect-[4/5] place-items-center border-[1.5px] border-ink bg-paper-3 meta text-ink-faint">
        {copy.piece.noPhoto}
      </div>
    );
  }
  return (
    <section aria-label={copy.item.photosTitle}>
      <ol className="grid grid-cols-2 gap-x-3 gap-y-6">
        {images.map((image, index) => {
          const lead = index === 0;
          return (
            <li key={image.id} className={lead ? "col-span-2" : ""}>
              <figure className="flex flex-col gap-2">
                <a
                  href={image.url}
                  className="relative block overflow-hidden border-[1.5px] border-ink bg-paper-3"
                  style={{ aspectRatio: `${image.width} / ${image.height}` }}
                >
                  <Image
                    src={image.url}
                    alt={image.alt_text || `${title}, ${copy.labels.imageKind[image.kind]}`}
                    fill
                    sizes={
                      lead ? "(min-width: 64rem) 50vw, 100vw" : "(min-width: 64rem) 25vw, 50vw"
                    }
                    placeholder={image.placeholder ? "blur" : "empty"}
                    blurDataURL={image.placeholder || undefined}
                    priority={lead}
                    className="object-cover"
                  />
                </a>
                <figcaption className="flex justify-between gap-2 meta text-ink-muted">
                  <span>{copy.labels.imageKind[image.kind]}</span>
                  <span aria-hidden className="text-ink-faint">
                    {pad2(index + 1)}/{pad2(images.length)}
                  </span>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
