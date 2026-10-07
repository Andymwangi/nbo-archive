from django.db import transaction
from django.db.models import F, Max, Q, QuerySet
from django.utils import timezone
from rest_framework import exceptions

from apps.catalog.images import InvalidImage, process_upload
from apps.catalog.models import (
    Accession,
    AccessionImage,
    AccessionStatus,
    Drop,
    DropStatus,
    Flaw,
    ImageKind,
    Sequence,
)
from apps.catalog.specs import MEASUREMENT_KEYS
from apps.common.exceptions import ConflictError

MAX_IMAGES = 12
MIN_IMAGES_TO_PUBLISH = 3

PUBLIC_STATUSES = (AccessionStatus.LIVE, AccessionStatus.HELD, AccessionStatus.CLAIMED)
# A sale is in progress or finished; the catalogue record is frozen until Holds/Orders release it.
LOCKED_STATUSES = (AccessionStatus.HELD, AccessionStatus.CLAIMED)


def next_number(name: str) -> int:
    """Take the next value of a named sequence. Must run inside a transaction."""
    sequence, _ = Sequence.objects.select_for_update().get_or_create(name=name)
    sequence.last_value = F("last_value") + 1
    sequence.save(update_fields=["last_value", "updated_at"])
    sequence.refresh_from_db(fields=["last_value"])
    return sequence.last_value


def public_accessions(now=None) -> QuerySet[Accession]:
    """Accessions a visitor may see. A scheduled piece is public from its release time, even
    before the release task has flipped its stored status."""
    now = now or timezone.now()
    return Accession.objects.filter(
        Q(status__in=PUBLIC_STATUSES) | Q(status=AccessionStatus.SCHEDULED, release_at__lte=now)
    )


def public_drops() -> QuerySet[Drop]:
    return Drop.objects.filter(status__in=[DropStatus.SCHEDULED, DropStatus.RELEASED])


def is_released(drop: Drop, now=None) -> bool:
    now = now or timezone.now()
    return drop.status == DropStatus.RELEASED or (
        drop.status == DropStatus.SCHEDULED
        and drop.release_at is not None
        and drop.release_at <= now
    )


def _lock(accession: Accession) -> Accession:
    """Re-read the accession under a row lock. The caller's copy may predate a concurrent write,
    or the row may have been deleted since the view loaded it."""
    try:
        return Accession.objects.select_for_update().get(pk=accession.pk)
    except Accession.DoesNotExist as exc:
        raise exceptions.NotFound() from exc


def _reload(model, instance):
    """Re-read a photo or flaw after its accession is locked, so the write starts from the
    committed row rather than the copy the view loaded."""
    try:
        return model.objects.get(pk=instance.pk)
    except model.DoesNotExist as exc:
        raise exceptions.NotFound() from exc


def _next_position(queryset) -> int:
    highest = queryset.aggregate(highest=Max("position"))["highest"]
    return 0 if highest is None else highest + 1


def _save_changes(instance, changes: dict) -> None:
    for field, value in changes.items():
        setattr(instance, field, value)
    instance.save(update_fields=[*changes, "updated_at"])


def _ensure_editable(accession: Accession) -> None:
    if accession.status in LOCKED_STATUSES:
        raise ConflictError(
            f"{accession.archive_no} is {accession.status}; it cannot be edited until the sale "
            "is released."
        )


# Accessions


def create_accession(*, actor, **fields) -> Accession:
    with transaction.atomic():
        number = next_number(Sequence.ACCESSION)
        return Accession.objects.create(number=number, created_by=actor, **fields)


def update_accession(accession: Accession, **changes) -> Accession:
    with transaction.atomic():
        accession = _lock(accession)
        _ensure_editable(accession)
        if (
            "drop" in changes
            and changes["drop"] != accession.drop
            and accession.status == AccessionStatus.SCHEDULED
        ):
            raise ConflictError("Withdraw this piece from its schedule before changing its drop.")
        new_drop = changes.get("drop")
        if (
            new_drop is not None
            and accession.status == AccessionStatus.LIVE
            and not is_released(new_drop)
        ):
            raise ConflictError(
                f"Accession {new_drop.number:02d} has not been released; a live piece cannot "
                "join it."
            )
        for field, value in changes.items():
            setattr(accession, field, value)
        accession.save()
        _ensure_still_publishable(accession)
    return accession


def delete_accession(accession: Accession) -> None:
    with transaction.atomic():
        accession = _lock(accession)
        if accession.status != AccessionStatus.DRAFT:
            raise ConflictError("Only drafts can be deleted. Withdraw published pieces instead.")
        files = [image.file.name for image in accession.images.all()]
        storage = AccessionImage._meta.get_field("file").storage
        accession.delete()
        transaction.on_commit(lambda: [storage.delete(name) for name in files])


def publication_problems(accession: Accession) -> dict[str, list[str]]:
    """Everything that stops a piece from going public, keyed by field."""
    problems: dict[str, list[str]] = {}

    def need(field: str, message: str) -> None:
        problems.setdefault(field, []).append(message)

    for field in ("title", "brand", "tagged_size", "colour", "fabric_composition"):
        if not getattr(accession, field).strip():
            need(field, "Required before publishing.")
    if not accession.condition_grade:
        need("condition_grade", "Required before publishing.")
    if not accession.price_kes:
        need("price_kes", "Set a price before publishing.")
    if accession.cleaned_at is None:
        need("cleaned_at", "Record the cleaned and inspected date before publishing.")

    missing = [key for key in MEASUREMENT_KEYS if key not in (accession.measurements or {})]
    if missing:
        need("measurements", f"Missing: {', '.join(missing)}.")

    images = list(accession.images.all())
    if len(images) < MIN_IMAGES_TO_PUBLISH:
        need("images", f"Add at least {MIN_IMAGES_TO_PUBLISH} photos.")
    if not any(image.kind == ImageKind.FRONT for image in images):
        need("images", "Add a front photo.")
    if any(flaw.image_id is None for flaw in accession.flaws.all()):
        need("flaws", "Every listed flaw needs a close-up photo.")
    return problems


def _ensure_publishable(accession: Accession) -> None:
    problems = publication_problems(accession)
    if problems:
        raise exceptions.ValidationError(problems)


def _ensure_still_publishable(accession: Accession) -> None:
    """A public or scheduled piece must stay complete through every edit."""
    if accession.status in (AccessionStatus.LIVE, AccessionStatus.SCHEDULED):
        _ensure_publishable(accession)


def publish_accession(accession: Accession) -> Accession:
    with transaction.atomic():
        accession = _lock(accession)
        _ensure_editable(accession)
        if accession.status == AccessionStatus.LIVE:
            return accession
        if accession.drop is not None and not is_released(accession.drop):
            raise ConflictError(
                f"Accession {accession.drop.number:02d} has not been released yet. "
                "Schedule this piece into it instead."
            )
        _ensure_publishable(accession)
        now = timezone.now()
        accession.status = AccessionStatus.LIVE
        accession.published_at = now
        accession.release_at = None
        accession.save()
    return accession


def schedule_accession(accession: Accession, *, release_at=None) -> Accession:
    with transaction.atomic():
        accession = _lock(accession)
        _ensure_editable(accession)
        if accession.status == AccessionStatus.LIVE:
            raise ConflictError(
                f"{accession.archive_no} is already live. Withdraw it before scheduling it again."
            )
        now = timezone.now()
        drop = accession.drop
        if drop is not None:
            if drop.status == DropStatus.DRAFT:
                raise ConflictError(f"Schedule Accession {drop.number:02d} before adding to it.")
            if is_released(drop, now):
                raise ConflictError(
                    f"Accession {drop.number:02d} is already out. Publish this piece instead."
                )
            release_at = drop.release_at
        elif release_at is None:
            raise exceptions.ValidationError({"release_at": ["Choose a release time."]})
        elif release_at <= now:
            raise exceptions.ValidationError(
                {"release_at": ["Choose a time in the future, or publish now."]}
            )

        _ensure_publishable(accession)
        accession.status = AccessionStatus.SCHEDULED
        accession.release_at = release_at
        accession.published_at = release_at
        accession.save()
    return accession


def withdraw_accession(accession: Accession) -> Accession:
    with transaction.atomic():
        accession = _lock(accession)
        _ensure_editable(accession)
        if accession.status == AccessionStatus.DRAFT:
            raise ConflictError("Drafts are not public; there is nothing to withdraw.")
        accession.status = AccessionStatus.WITHDRAWN
        accession.release_at = None
        accession.save()
    return accession


# Images


def _ensure_room_for_photo(accession: Accession) -> None:
    if accession.images.count() >= MAX_IMAGES:
        raise exceptions.ValidationError(
            {"file": [f"A piece can have at most {MAX_IMAGES} photos."]}
        )


def add_image(accession: Accession, *, upload, kind: str, alt_text: str = "") -> AccessionImage:
    # Cheap checks first, so a rejected upload is not decoded and re-encoded for nothing. They
    # are repeated under the lock below, which is what actually guards the write.
    current = Accession.objects.filter(pk=accession.pk).first()
    if current is None:
        raise exceptions.NotFound()
    _ensure_editable(current)
    _ensure_room_for_photo(current)

    try:
        processed = process_upload(upload)
    except InvalidImage as exc:
        raise exceptions.ValidationError({"file": [str(exc)]}) from exc

    # The file is written before the row so a failed transaction can remove it again.
    field = AccessionImage._meta.get_field("file")
    stored = field.storage.save(field.generate_filename(None, "photo.jpg"), processed.content)
    try:
        with transaction.atomic():
            accession = _lock(accession)
            _ensure_editable(accession)
            _ensure_room_for_photo(accession)
            return AccessionImage.objects.create(
                accession=accession,
                kind=kind,
                file=stored,
                width=processed.width,
                height=processed.height,
                placeholder=processed.placeholder,
                alt_text=alt_text,
                position=_next_position(accession.images),
            )
    except BaseException:
        field.storage.delete(stored)
        raise


def update_image(image: AccessionImage, **changes) -> AccessionImage:
    with transaction.atomic():
        accession = _lock(image.accession)
        _ensure_editable(accession)
        image = _reload(AccessionImage, image)
        _save_changes(image, changes)
        _ensure_still_publishable(accession)
    return image


def delete_image(image: AccessionImage) -> None:
    with transaction.atomic():
        accession = _lock(image.accession)
        _ensure_editable(accession)
        image = _reload(AccessionImage, image)
        name, storage = image.file.name, image.file.storage
        image.delete()
        _ensure_still_publishable(accession)
        transaction.on_commit(lambda: storage.delete(name))


def reorder_images(accession: Accession, ordered_ids: list[int]) -> list[AccessionImage]:
    with transaction.atomic():
        accession = _lock(accession)
        _ensure_editable(accession)
        images = {image.pk: image for image in accession.images.all()}
        if sorted(ordered_ids) != sorted(images):
            raise exceptions.ValidationError(
                {"ids": ["List every photo of this piece exactly once."]}
            )
        # bulk_update skips auto_now, so the timestamp is set by hand.
        now = timezone.now()
        for position, pk in enumerate(ordered_ids):
            images[pk].position = position
            images[pk].updated_at = now
        AccessionImage.objects.bulk_update(images.values(), ["position", "updated_at"])
    return [images[pk] for pk in ordered_ids]


# Flaws


def _check_flaw_image(accession: Accession, image: AccessionImage | None) -> None:
    if image is not None and image.accession_id != accession.pk:
        raise exceptions.ValidationError({"image": ["That photo belongs to another piece."]})


def add_flaw(accession: Accession, *, description: str, image=None) -> Flaw:
    with transaction.atomic():
        accession = _lock(accession)
        _ensure_editable(accession)
        _check_flaw_image(accession, image)
        flaw = Flaw.objects.create(
            accession=accession,
            description=description,
            image=image,
            position=_next_position(accession.flaws),
        )
        _ensure_still_publishable(accession)
        return flaw


def update_flaw(flaw: Flaw, **changes) -> Flaw:
    with transaction.atomic():
        accession = _lock(flaw.accession)
        _ensure_editable(accession)
        if "image" in changes:
            _check_flaw_image(accession, changes["image"])
        flaw = _reload(Flaw, flaw)
        _save_changes(flaw, changes)
        _ensure_still_publishable(accession)
    return flaw


def delete_flaw(flaw: Flaw) -> None:
    with transaction.atomic():
        _ensure_editable(_lock(flaw.accession))
        _reload(Flaw, flaw).delete()


# Drops


def create_drop(*, title: str, intro: str = "") -> Drop:
    with transaction.atomic():
        return Drop.objects.create(number=next_number(Sequence.DROP), title=title, intro=intro)


def update_drop(drop: Drop, **changes) -> Drop:
    # Only the edited columns are written, so an edit racing the release task cannot put back
    # the status or release time it had when the view loaded it.
    with transaction.atomic():
        try:
            drop = Drop.objects.select_for_update().get(pk=drop.pk)
        except Drop.DoesNotExist as exc:
            raise exceptions.NotFound() from exc
        _save_changes(drop, changes)
    return drop


def schedule_drop(drop: Drop, *, release_at) -> Drop:
    with transaction.atomic():
        drop = Drop.objects.select_for_update().get(pk=drop.pk)
        if is_released(drop):
            raise ConflictError(f"Accession {drop.number:02d} is already out.")
        if release_at <= timezone.now():
            raise exceptions.ValidationError(
                {"release_at": ["Choose a time in the future, or release now."]}
            )
        drop.status = DropStatus.SCHEDULED
        drop.release_at = release_at
        drop.save()
        Accession.objects.filter(drop=drop, status=AccessionStatus.SCHEDULED).update(
            release_at=release_at, published_at=release_at, updated_at=timezone.now()
        )
    return drop


def release_drop(drop: Drop, now=None) -> Drop:
    with transaction.atomic():
        drop = Drop.objects.select_for_update().get(pk=drop.pk)
        if drop.status == DropStatus.RELEASED:
            return drop
        now = now or timezone.now()
        if drop.status == DropStatus.SCHEDULED and drop.release_at and drop.release_at <= now:
            now = drop.release_at
        drop.status = DropStatus.RELEASED
        drop.release_at = now
        drop.save()
        Accession.objects.filter(drop=drop, status=AccessionStatus.SCHEDULED).update(
            status=AccessionStatus.LIVE,
            release_at=None,
            published_at=now,
            updated_at=timezone.now(),
        )
    return drop


def delete_drop(drop: Drop) -> None:
    with transaction.atomic():
        drop = Drop.objects.select_for_update().get(pk=drop.pk)
        if drop.status != DropStatus.DRAFT:
            raise ConflictError("Only draft drops can be deleted.")
        drop.delete()


def release_due(now=None) -> tuple[int, int]:
    """Promote drops and pieces whose release time has passed. Returns (drops, pieces)."""
    now = now or timezone.now()
    released_drops = 0
    for drop in Drop.objects.filter(status=DropStatus.SCHEDULED, release_at__lte=now):
        release_drop(drop, now=now)
        released_drops += 1
    pieces = Accession.objects.filter(status=AccessionStatus.SCHEDULED, release_at__lte=now).update(
        status=AccessionStatus.LIVE, release_at=None, updated_at=now
    )
    return released_drops, pieces
