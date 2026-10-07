"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";

import { arrangePhotoAction, savePhotoAction } from "@/app/admin/catalogue-actions";
import { FormNote, SelectField, TextField, useActionFocus } from "@/components/form/Field";
import { Button } from "@/components/primitives/Button";
import { ConfirmDialog } from "@/components/primitives/Dialog";
import { copy } from "@/content/copy";
import { type AdminPiece, MAX_PHOTOS, MAX_UPLOAD_BYTES } from "@/lib/api/admin";
import { type ArchiveImage, imageKinds } from "@/lib/api/catalog";
import { isApiError } from "@/lib/api/errors";
import { uploadPiecePhoto } from "@/lib/desk/photos";
import { idleState } from "@/lib/form-state";

const kindOptions = imageKinds.map((kind) => ({ value: kind, label: copy.labels.imageKind[kind] }));

export function PhotoManager({ piece, readOnly }: { piece: AdminPiece; readOnly: boolean }) {
  const order = piece.images.map((image) => image.id).join(",");
  return (
    <div className="flex flex-col gap-8">
      {piece.images.length ? (
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {piece.images.map((image, index) => (
            <PhotoCard
              key={image.id}
              pieceId={piece.id}
              image={image}
              index={index}
              total={piece.images.length}
              order={order}
              readOnly={readOnly}
            />
          ))}
        </ol>
      ) : (
        <p className="text-meta text-ink-muted">{copy.photosDesk.none}</p>
      )}
      {readOnly ? null : <Uploader pieceId={piece.id} count={piece.images.length} />}
    </div>
  );
}

function PhotoCard({
  pieceId,
  image,
  index,
  total,
  order,
  readOnly,
}: {
  pieceId: number;
  image: ArchiveImage;
  index: number;
  total: number;
  order: string;
  readOnly: boolean;
}) {
  const [saved, saveAction, saving] = useActionState(savePhotoAction, idleState);
  const [arranged, arrangeAction, arranging] = useActionState(arrangePhotoAction, idleState);
  const focusRef = useActionFocus(saved);
  const removeId = `photo-${image.id}-remove`;
  const busy = saving || arranging;

  return (
    <li>
      <div ref={focusRef} className="flex flex-col gap-4 border-t-[1.5px] border-ink pt-3">
        <div className="flex items-baseline justify-between">
          <span className="meta">{copy.photosDesk.position(index + 1)}</span>
          <span className="meta text-ink-muted">
            {image.width} x {image.height}
          </span>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-paper-2">
          <Image
            src={image.url}
            alt={image.alt_text}
            fill
            sizes="(min-width: 64rem) 20rem, (min-width: 30rem) 45vw, 90vw"
            placeholder={image.placeholder ? "blur" : "empty"}
            blurDataURL={image.placeholder || undefined}
            className="object-cover"
          />
        </div>

        <form action={saveAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="id" value={pieceId} />
          <input type="hidden" name="image_id" value={image.id} />
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <SelectField
              label={copy.photosDesk.kindLabel}
              name="kind"
              defaultValue={saved.values?.kind ?? image.kind}
              error={saved.fields?.kind}
              options={kindOptions}
            />
            <TextField
              label={copy.photosDesk.altLabel}
              hint={copy.photosDesk.altHint}
              name="alt_text"
              maxLength={160}
              defaultValue={saved.values?.alt_text ?? image.alt_text}
              error={saved.fields?.alt_text}
            />
            {readOnly ? null : (
              <Button type="submit" variant="quiet" disabled={busy} className="self-start">
                {saving ? copy.pieceDesk.saving : copy.pieceDesk.save}
              </Button>
            )}
          </fieldset>
        </form>

        {readOnly ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {(["up", "down"] as const).map((direction) => {
              const edge = direction === "up" ? index === 0 : index === total - 1;
              return (
                <form key={direction} action={arrangeAction}>
                  <input type="hidden" name="intent" value={direction} />
                  <input type="hidden" name="id" value={pieceId} />
                  <input type="hidden" name="image_id" value={image.id} />
                  <input type="hidden" name="order" value={order} />
                  <Button
                    type="submit"
                    variant="quiet"
                    icon={direction === "up" ? "chevron-up" : "chevron-down"}
                    iconPosition="start"
                    disabled={busy || edge}
                    aria-label={`${direction === "up" ? copy.photosDesk.moveUp : copy.photosDesk.moveDown}: ${copy.photosDesk.position(index + 1)}`}
                  >
                    {direction === "up" ? copy.photosDesk.moveUp : copy.photosDesk.moveDown}
                  </Button>
                </form>
              );
            })}
            <form id={removeId} action={arrangeAction} hidden>
              <input type="hidden" name="intent" value="remove" />
              <input type="hidden" name="id" value={pieceId} />
              <input type="hidden" name="image_id" value={image.id} />
            </form>
            <ConfirmDialog
              formId={removeId}
              trigger={copy.photosDesk.remove}
              triggerIcon="trash"
              triggerVariant="quiet"
              title={copy.photosDesk.removeTitle}
              body={copy.photosDesk.removeBody}
              confirm={copy.photosDesk.remove}
              disabled={busy}
            />
          </div>
        )}

        {saved.status !== "idle" && saved.message ? (
          <FormNote tone={saved.status === "ok" ? "ok" : "error"}>{saved.message}</FormNote>
        ) : null}
        {arranged.status === "error" && arranged.message ? (
          <FormNote tone="error">{arranged.message}</FormNote>
        ) : null}
      </div>
    </li>
  );
}

type Outcome = { tone: "ok" | "error"; lines: string[] };

/*
  Uploads go one at a time through the photo route, so each file reports its own failure and
  the progress line can count through them. The page refreshes once at the end.
*/
function Uploader({ pieceId, count }: { pieceId: number; count: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const [kind, setKind] = useState<string>(count === 0 ? "front" : "back");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const room = MAX_PHOTOS - count;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = Array.from(inputRef.current?.files ?? []);
    if (!files.length) {
      setOutcome({ tone: "error", lines: [copy.photosDesk.pickFiles] });
      return;
    }
    if (files.length > room) {
      setOutcome({ tone: "error", lines: [copy.photosDesk.tooMany(room)] });
      return;
    }

    const failures: string[] = [];
    let added = 0;
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length });
      if (file.size > MAX_UPLOAD_BYTES) {
        failures.push(copy.photosDesk.failed(file.name, copy.photosDesk.tooBig));
        continue;
      }
      try {
        await uploadPiecePhoto(pieceId, file, kind);
        added += 1;
      } catch (error) {
        const reason = isApiError(error) ? error.message : copy.errors.unexpected;
        failures.push(copy.photosDesk.failed(file.name, reason));
        // A lost session fails every later file the same way; stop rather than repeat it.
        if (isApiError(error) && error.status === 401) break;
      }
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    setOutcome(
      failures.length
        ? {
            tone: "error",
            lines: [...(added ? [copy.photosDesk.uploaded(added)] : []), ...failures],
          }
        : { tone: "ok", lines: [copy.photosDesk.uploaded(added)] },
    );
    if (added) router.refresh();
  }

  if (room <= 0) return <p className="text-meta text-ink-muted">{copy.photosDesk.full}</p>;

  return (
    <form
      onSubmit={upload}
      className="flex flex-col gap-5 border-[1.5px] border-dashed border-ink-faint p-5"
    >
      <p className="font-display text-lead">{copy.photosDesk.add}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileId} className="meta text-ink-muted">
            {copy.photosDesk.fileLabel}
          </label>
          <input
            ref={inputRef}
            id={fileId}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={progress !== null}
            aria-describedby={`${fileId}-hint`}
            className="min-h-12 py-2 text-meta file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-tag file:border-[1.5px] file:border-ink file:bg-transparent file:px-3 file:font-meta file:text-meta file:uppercase"
          />
          <p id={`${fileId}-hint`} className="text-meta text-ink-muted">
            {copy.photosDesk.hint}
          </p>
        </div>
        <SelectField
          label={copy.photosDesk.kindLabel}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          disabled={progress !== null}
          options={kindOptions}
        />
      </div>
      {progress ? (
        <p role="status" className="meta">
          {copy.photosDesk.uploading(progress.done, progress.total)}
        </p>
      ) : null}
      {outcome ? (
        <FormNote tone={outcome.tone}>
          {outcome.lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </FormNote>
      ) : null}
      <Button
        type="submit"
        icon="upload"
        iconPosition="start"
        disabled={progress !== null}
        className="self-start"
      >
        {copy.photosDesk.add}
      </Button>
    </form>
  );
}
