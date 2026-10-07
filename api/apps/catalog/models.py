import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q

from apps.catalog.specs import chest_band, format_archive_no
from apps.common.models import TimeStampedModel


class Category(models.TextChoices):
    POLO = "polo", "Polo shirts"
    JACKET = "jacket", "Jackets"
    SWEATER = "sweater", "Sweaters"
    HOODIE = "hoodie", "Hoodies"
    TEE = "tee", "T-shirts"


class ConditionGrade(models.TextChoices):
    MINT = "mint", "Mint"
    EXCELLENT = "excellent", "Excellent"
    GOOD = "good", "Good"
    WORN_IN = "worn_in", "Worn-in"


class AccessionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SCHEDULED = "scheduled", "Scheduled"
    LIVE = "live", "Live"
    HELD = "held", "Held"
    CLAIMED = "claimed", "Claimed"
    WITHDRAWN = "withdrawn", "Withdrawn"


class DropStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SCHEDULED = "scheduled", "Scheduled"
    RELEASED = "released", "Released"


class ImageKind(models.TextChoices):
    FRONT = "front", "Front"
    BACK = "back", "Back"
    TAG = "tag", "Brand tag"
    CARE = "care", "Care label"
    TEXTURE = "texture", "Fabric texture"
    FLAW = "flaw", "Flaw close-up"
    ON_BODY = "on_body", "On body"


class ChestBand(models.TextChoices):
    XS = "xs", "XS"
    S = "s", "S"
    M = "m", "M"
    L = "l", "L"
    XL = "xl", "XL"
    XXL = "xxl", "XXL"


class Sequence(TimeStampedModel):
    """Named counters for public numbers (archive numbers, drop numbers). Numbers are taken
    under a row lock and never handed out twice, even when the record that took one is deleted."""

    ACCESSION = "accession"
    DROP = "drop"

    name = models.CharField(max_length=32, primary_key=True)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sequences"

    def __str__(self) -> str:
        return f"{self.name}={self.last_value}"


class Drop(TimeStampedModel):
    number = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=120)
    intro = models.TextField(blank=True)
    release_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=DropStatus.choices, default=DropStatus.DRAFT)

    class Meta:
        db_table = "drops"
        ordering = ["-number"]
        indexes = [models.Index(fields=["status", "release_at"])]

    def __str__(self) -> str:
        return f"Accession {self.number:02d}: {self.title}"


class Accession(TimeStampedModel):
    """One catalogued garment. Every accession is a single physical item."""

    number = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=16, choices=Category.choices)
    brand = models.CharField(max_length=80, blank=True)
    tagged_size = models.CharField(max_length=24, blank=True)
    fit_note = models.CharField(max_length=120, blank=True)
    colour = models.CharField(max_length=40, blank=True)
    fabric_composition = models.CharField(max_length=160, blank=True)
    era = models.CharField(max_length=40, blank=True)
    condition_grade = models.CharField(max_length=16, choices=ConditionGrade.choices, blank=True)
    measurements = models.JSONField(default=dict, blank=True)
    chest_band = models.CharField(max_length=8, choices=ChestBand.choices, blank=True)
    category_extras = models.JSONField(default=dict, blank=True)
    cleaned_at = models.DateField(null=True, blank=True)
    provenance_note = models.TextField(max_length=600, blank=True)
    price_kes = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=AccessionStatus.choices, default=AccessionStatus.DRAFT
    )
    drop = models.ForeignKey(
        Drop, null=True, blank=True, on_delete=models.SET_NULL, related_name="accessions"
    )
    release_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    tags = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    claimed_city = models.CharField(max_length=60, blank=True)
    is_placeholder = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accessions",
    )

    class Meta:
        db_table = "accessions"
        ordering = ["-number"]
        indexes = [
            models.Index(fields=["status", "published_at"]),
            models.Index(fields=["status", "release_at"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["chest_band"]),
            models.Index(fields=["price_kes"]),
            models.Index(fields=["era"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(status="scheduled") | Q(release_at__isnull=False),
                name="accession_scheduled_has_release_at",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.archive_no} {self.title}".strip()

    @property
    def archive_no(self) -> str:
        return format_archive_no(self.number)

    def save(self, *args, **kwargs):
        chest = (self.measurements or {}).get("chest")
        self.chest_band = chest_band(chest if isinstance(chest, int) else None)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "measurements" in update_fields:
            kwargs["update_fields"] = {*update_fields, "chest_band"}
        super().save(*args, **kwargs)


def _image_path(instance: "AccessionImage", filename: str) -> str:
    return f"accessions/{uuid.uuid4().hex}.jpg"


class AccessionImage(TimeStampedModel):
    accession = models.ForeignKey(Accession, on_delete=models.CASCADE, related_name="images")
    kind = models.CharField(max_length=16, choices=ImageKind.choices)
    file = models.ImageField(upload_to=_image_path, width_field="width", height_field="height")
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    placeholder = models.TextField(blank=True)
    alt_text = models.CharField(max_length=160, blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "accession_images"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.accession.archive_no} {self.kind} #{self.position}"


class Flaw(TimeStampedModel):
    accession = models.ForeignKey(Accession, on_delete=models.CASCADE, related_name="flaws")
    description = models.CharField(max_length=280)
    image = models.ForeignKey(
        AccessionImage, null=True, blank=True, on_delete=models.SET_NULL, related_name="flaws"
    )
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "flaws"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.description[:60]
