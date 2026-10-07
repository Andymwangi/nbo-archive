from django.conf import settings
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.models import (
    Accession,
    AccessionImage,
    AccessionStatus,
    Category,
    ConditionGrade,
    Drop,
    Flaw,
    ImageKind,
)
from apps.catalog.services import is_released, publication_problems
from apps.catalog.specs import (
    CATEGORY_EXTRAS,
    EXTRA_TEXT_MAX,
    MEASUREMENT_KEYS,
    MEASUREMENT_MAX_CM,
    MEASUREMENT_MIN_CM,
)


def _absolute(request, url: str) -> str:
    if not url.startswith("/"):
        return url
    if settings.MEDIA_BASE_URL:
        return settings.MEDIA_BASE_URL + url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


class ImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = AccessionImage
        fields = ["id", "kind", "url", "width", "height", "placeholder", "alt_text", "position"]
        read_only_fields = fields

    def get_url(self, image: AccessionImage) -> str:
        return _absolute(self.context.get("request"), image.file.url)


class FlawSerializer(serializers.ModelSerializer):
    image_id = serializers.IntegerField(allow_null=True, read_only=True)

    class Meta:
        model = Flaw
        fields = ["id", "description", "image_id", "position"]
        read_only_fields = fields


class DropSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Drop
        fields = ["number", "title", "release_at"]
        read_only_fields = fields


class PublicStatusMixin:
    @extend_schema_field(serializers.ChoiceField(choices=["live", "held", "claimed"]))
    def get_status(self, accession: Accession) -> str:
        # A scheduled piece is only ever serialised publicly once its release time has passed.
        if accession.status == AccessionStatus.SCHEDULED:
            return AccessionStatus.LIVE
        return accession.status


class CoverMixin:
    """The listing photo: the front shot, or the first photo when there is none."""

    @extend_schema_field(ImageSerializer(allow_null=True))
    def get_cover(self, accession: Accession):
        images = list(accession.images.all())
        cover = next(
            (i for i in images if i.kind == ImageKind.FRONT), images[0] if images else None
        )
        return ImageSerializer(cover, context=self.context).data if cover else None


class PublicAccessionCardSerializer(CoverMixin, PublicStatusMixin, serializers.ModelSerializer):
    archive_no = serializers.CharField(read_only=True)
    status = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()
    drop_number = serializers.IntegerField(source="drop.number", allow_null=True, read_only=True)

    class Meta:
        model = Accession
        fields = [
            "archive_no",
            "title",
            "category",
            "brand",
            "tagged_size",
            "chest_band",
            "colour",
            "era",
            "condition_grade",
            "price_kes",
            "status",
            "drop_number",
            "published_at",
            "is_placeholder",
            "cover",
        ]
        read_only_fields = fields


class PublicAccessionSerializer(PublicStatusMixin, serializers.ModelSerializer):
    archive_no = serializers.CharField(read_only=True)
    status = serializers.SerializerMethodField()
    images = ImageSerializer(many=True, read_only=True)
    flaws = FlawSerializer(many=True, read_only=True)
    drop = DropSummarySerializer(read_only=True, allow_null=True)
    claimed = serializers.SerializerMethodField()

    class Meta:
        model = Accession
        fields = [
            "archive_no",
            "title",
            "category",
            "brand",
            "tagged_size",
            "fit_note",
            "colour",
            "fabric_composition",
            "era",
            "condition_grade",
            "measurements",
            "chest_band",
            "category_extras",
            "cleaned_at",
            "provenance_note",
            "price_kes",
            "status",
            "drop",
            "published_at",
            "is_placeholder",
            "images",
            "flaws",
            "claimed",
        ]
        read_only_fields = fields

    @extend_schema_field(
        serializers.DictField(allow_null=True, help_text="{'city': str, 'claimed_at': datetime}")
    )
    def get_claimed(self, accession: Accession):
        if accession.status != AccessionStatus.CLAIMED:
            return None
        return {"city": accession.claimed_city, "claimed_at": accession.claimed_at}


class PublicAccessionDetailSerializer(PublicAccessionSerializer):
    related = serializers.SerializerMethodField()

    class Meta(PublicAccessionSerializer.Meta):
        fields = [*PublicAccessionSerializer.Meta.fields, "related"]
        read_only_fields = fields

    @extend_schema_field(PublicAccessionCardSerializer(many=True))
    def get_related(self, accession: Accession):
        related = self.context.get("related", [])
        return PublicAccessionCardSerializer(related, many=True, context=self.context).data


class PublicDropSerializer(serializers.ModelSerializer):
    released = serializers.SerializerMethodField()
    piece_count = serializers.SerializerMethodField()

    class Meta:
        model = Drop
        fields = ["number", "title", "intro", "release_at", "released", "piece_count"]
        read_only_fields = fields

    def get_released(self, drop: Drop) -> bool:
        return is_released(drop)

    def get_piece_count(self, drop: Drop) -> int:
        return getattr(drop, "piece_count", 0)


class FacetCountSerializer(serializers.Serializer):
    value = serializers.CharField()
    count = serializers.IntegerField()


class FacetsSerializer(serializers.Serializer):
    category = FacetCountSerializer(many=True)
    chest_band = FacetCountSerializer(many=True)
    condition = FacetCountSerializer(many=True)
    brand = FacetCountSerializer(many=True)
    colour = FacetCountSerializer(many=True)
    era = FacetCountSerializer(many=True)
    drop = FacetCountSerializer(many=True)
    price_min = serializers.IntegerField(allow_null=True)
    price_max = serializers.IntegerField(allow_null=True)


# Admin


class AdminAccessionListSerializer(CoverMixin, serializers.ModelSerializer):
    archive_no = serializers.CharField(read_only=True)
    drop_number = serializers.IntegerField(source="drop.number", allow_null=True, read_only=True)
    image_count = serializers.IntegerField(read_only=True)
    cover = serializers.SerializerMethodField()

    class Meta:
        model = Accession
        fields = [
            "id",
            "archive_no",
            "title",
            "category",
            "brand",
            "condition_grade",
            "price_kes",
            "status",
            "drop_number",
            "release_at",
            "published_at",
            "is_placeholder",
            "image_count",
            "cover",
            "updated_at",
        ]
        read_only_fields = fields


class AdminAccessionSerializer(serializers.ModelSerializer):
    archive_no = serializers.CharField(read_only=True)
    drop = DropSummarySerializer(read_only=True, allow_null=True)
    drop_id = serializers.IntegerField(allow_null=True, read_only=True)
    images = ImageSerializer(many=True, read_only=True)
    flaws = FlawSerializer(many=True, read_only=True)
    created_by = serializers.EmailField(source="created_by.email", allow_null=True, read_only=True)
    problems = serializers.SerializerMethodField()

    class Meta:
        model = Accession
        fields = [
            "id",
            "archive_no",
            "title",
            "category",
            "brand",
            "tagged_size",
            "fit_note",
            "colour",
            "fabric_composition",
            "era",
            "condition_grade",
            "measurements",
            "chest_band",
            "category_extras",
            "cleaned_at",
            "provenance_note",
            "price_kes",
            "status",
            "drop",
            "drop_id",
            "release_at",
            "published_at",
            "tags",
            "claimed_at",
            "claimed_city",
            "is_placeholder",
            "images",
            "flaws",
            "created_by",
            "problems",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(
        serializers.DictField(
            child=serializers.ListField(child=serializers.CharField()),
            help_text="Field -> reasons this piece cannot be published yet. Empty when ready.",
        )
    )
    def get_problems(self, accession: Accession):
        return publication_problems(accession)


def _validate_measurements(value) -> dict:
    if not isinstance(value, dict):
        raise serializers.ValidationError("Send measurements as an object of centimetres.")
    unknown = sorted(set(value) - set(MEASUREMENT_KEYS))
    if unknown:
        raise serializers.ValidationError(f"Unknown measurement: {', '.join(unknown)}.")
    cleaned = {}
    for key in MEASUREMENT_KEYS:
        if key not in value or value[key] in (None, ""):
            continue
        number = value[key]
        if isinstance(number, bool) or not isinstance(number, int):
            raise serializers.ValidationError(f"{key.capitalize()} must be whole centimetres.")
        if not MEASUREMENT_MIN_CM <= number <= MEASUREMENT_MAX_CM:
            raise serializers.ValidationError(
                f"{key.capitalize()} must be between {MEASUREMENT_MIN_CM} and "
                f"{MEASUREMENT_MAX_CM} cm."
            )
        cleaned[key] = number
    return cleaned


def _validate_extras(category: str, value) -> dict:
    if not isinstance(value, dict):
        raise serializers.ValidationError({"category_extras": ["Send extras as an object."]})
    spec = CATEGORY_EXTRAS[category]
    errors: list[str] = []
    cleaned = {}
    for key, raw in value.items():
        if key not in spec:
            errors.append(f"{key} does not apply to {Category(category).label.lower()}.")
            continue
        if raw in (None, ""):
            continue
        if not isinstance(raw, str):
            errors.append(f"{key} must be text.")
            continue
        text = raw.strip()
        choices = spec[key]
        if choices is not None and text not in choices:
            errors.append(f"{key} must be one of: {', '.join(choices)}.")
        elif len(text) > EXTRA_TEXT_MAX:
            errors.append(f"{key} must be {EXTRA_TEXT_MAX} characters or fewer.")
        else:
            cleaned[key] = text
    if errors:
        raise serializers.ValidationError({"category_extras": errors})
    return cleaned


class AccessionWriteSerializer(serializers.Serializer):
    """Drafts may be saved half-filled; completeness is checked when publishing."""

    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    category = serializers.ChoiceField(choices=Category.choices)
    brand = serializers.CharField(max_length=80, required=False, allow_blank=True)
    tagged_size = serializers.CharField(max_length=24, required=False, allow_blank=True)
    fit_note = serializers.CharField(max_length=120, required=False, allow_blank=True)
    colour = serializers.CharField(max_length=40, required=False, allow_blank=True)
    fabric_composition = serializers.CharField(max_length=160, required=False, allow_blank=True)
    era = serializers.CharField(max_length=40, required=False, allow_blank=True)
    condition_grade = serializers.ChoiceField(
        choices=ConditionGrade.choices,
        required=False,
        allow_blank=True,
    )
    measurements = serializers.JSONField(required=False)
    category_extras = serializers.JSONField(required=False)
    cleaned_at = serializers.DateField(required=False, allow_null=True)
    provenance_note = serializers.CharField(max_length=600, required=False, allow_blank=True)
    price_kes = serializers.IntegerField(
        min_value=1, max_value=10_000_000, required=False, allow_null=True
    )
    drop_id = serializers.PrimaryKeyRelatedField(
        queryset=Drop.objects.all(), source="drop", required=False, allow_null=True
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=40), max_length=20, required=False
    )

    def validate_measurements(self, value):
        return _validate_measurements(value)

    def validate_tags(self, value):
        return sorted({tag.strip().lower() for tag in value if tag.strip()})

    def validate(self, attrs):
        instance: Accession | None = self.instance
        category = attrs.get("category") or (instance.category if instance else None)
        if "category_extras" in attrs:
            attrs["category_extras"] = _validate_extras(category, attrs["category_extras"])
        elif instance is not None and category != instance.category:
            # Extras describe one category; carrying them across would mislabel the piece.
            attrs["category_extras"] = {}
        return attrs


class ScheduleSerializer(serializers.Serializer):
    release_at = serializers.DateTimeField(required=False, allow_null=True)


class ImageUploadSerializer(serializers.Serializer):
    file = serializers.ImageField()
    kind = serializers.ChoiceField(choices=ImageKind.choices)
    alt_text = serializers.CharField(max_length=160, required=False, allow_blank=True)


class ImageUpdateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=ImageKind.choices, required=False)
    alt_text = serializers.CharField(max_length=160, required=False, allow_blank=True)


class ImageOrderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class FlawWriteSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=280)
    image_id = serializers.PrimaryKeyRelatedField(
        queryset=AccessionImage.objects.all(), source="image", required=False, allow_null=True
    )


class AdminDropSerializer(serializers.ModelSerializer):
    piece_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Drop
        fields = [
            "id",
            "number",
            "title",
            "intro",
            "release_at",
            "status",
            "piece_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DropWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120)
    intro = serializers.CharField(required=False, allow_blank=True)


class DropScheduleSerializer(serializers.Serializer):
    release_at = serializers.DateTimeField()
