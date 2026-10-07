from django.db.models import Count, Max, Min, Q
from django.db.models.functions import Lower
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AdminRole
from apps.catalog import services
from apps.catalog.filters import AdminAccessionFilter, PublicAccessionFilter
from apps.catalog.models import (
    Accession,
    AccessionImage,
    AccessionStatus,
    Drop,
    DropStatus,
    Flaw,
)
from apps.catalog.serializers import (
    AccessionWriteSerializer,
    AdminAccessionListSerializer,
    AdminAccessionSerializer,
    AdminDropSerializer,
    DropScheduleSerializer,
    DropWriteSerializer,
    FacetsSerializer,
    FlawSerializer,
    FlawWriteSerializer,
    ImageOrderSerializer,
    ImageSerializer,
    ImageUpdateSerializer,
    ImageUploadSerializer,
    PublicAccessionCardSerializer,
    PublicAccessionDetailSerializer,
    PublicDropSerializer,
    PulseSerializer,
    ScheduleSerializer,
)
from apps.catalog.specs import parse_archive_no
from apps.common.permissions import HasAdminRole

CATALOG_TAG = "Catalog"
ADMIN_CATALOG_TAG = "Admin catalog"
ADMIN_DROPS_TAG = "Admin drops"

NOT_SIGNED_IN = OpenApiResponse(description="Not signed in")
WRITER_REQUIRED = OpenApiResponse(description="Owner or editor role required")
NOT_FOUND = OpenApiResponse(description="Not found")
VALIDATION = OpenApiResponse(description="Validation error")
CONFLICT = OpenApiResponse(description="Not allowed in the piece's or drop's current state")

RELATED_LIMIT = 4
ON_RAIL = [AccessionStatus.LIVE, AccessionStatus.SCHEDULED]
SALE_STATUSES = [
    AccessionStatus.SCHEDULED,
    AccessionStatus.LIVE,
    AccessionStatus.HELD,
    AccessionStatus.CLAIMED,
]


class CatalogWriterMixin:
    """Any admin may read the catalogue; only owners and editors may change it."""

    permission_classes = [HasAdminRole]
    write_roles = [AdminRole.OWNER, AdminRole.EDITOR]


def _admin_accession_queryset():
    return Accession.objects.select_related("drop", "created_by").prefetch_related(
        "images", "flaws"
    )


def _admin_detail(accession: Accession, request) -> Response:
    fresh = _admin_accession_queryset().get(pk=accession.pk)
    return Response(AdminAccessionSerializer(fresh, context={"request": request}).data)


# Public


class PublicAccessionListView(generics.ListAPIView):
    authentication_classes: list = []
    permission_classes: list = []
    serializer_class = PublicAccessionCardSerializer
    filterset_class = PublicAccessionFilter

    def get_queryset(self):
        return services.public_accessions().select_related("drop").prefetch_related("images")

    @extend_schema(
        tags=[CATALOG_TAG],
        summary="Browse the archive",
        description=(
            "Public pieces, newest first. Claimed pieces are left out unless "
            "`include_claimed=true`. Multi-value filters repeat the parameter "
            "(`?category=polo&category=tee`); brand, colour and era take comma-separated values."
        ),
        auth=[],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PublicAccessionDetailView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(
        tags=[CATALOG_TAG],
        summary="One piece by archive number",
        description="Accepts `NBO-0142`, `0142` or `142`.",
        responses={200: PublicAccessionDetailSerializer, 404: NOT_FOUND},
        auth=[],
    )
    def get(self, request, archive_no: str):
        number = parse_archive_no(archive_no)
        if number is None:
            raise Http404
        accession = get_object_or_404(
            services.public_accessions().select_related("drop").prefetch_related("images", "flaws"),
            number=number,
        )
        related = []
        if accession.era:
            related = (
                services.public_accessions()
                .exclude(pk=accession.pk)
                .exclude(status=AccessionStatus.CLAIMED)
                .filter(era__iexact=accession.era)
                .select_related("drop")
                .prefetch_related("images")
                .order_by("-published_at", "-number")[:RELATED_LIMIT]
            )
        context = {"request": request, "related": related}
        return Response(PublicAccessionDetailSerializer(accession, context=context).data)


def _counts(queryset, field: str) -> list[dict]:
    rows = queryset.exclude(**{field: ""}).values(field).annotate(count=Count("pk")).order_by(field)
    return [{"value": row[field], "count": row["count"]} for row in rows]


def _text_counts(queryset, field: str) -> list[dict]:
    """Group free-text values case-insensitively, as the browse filters match them."""
    rows = (
        queryset.exclude(**{field: ""})
        .annotate(key=Lower(field))
        .values("key")
        .annotate(value=Min(field), count=Count("pk"))
        .order_by("key")
    )
    return [{"value": row["value"], "count": row["count"]} for row in rows]


class FacetsView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(
        tags=[CATALOG_TAG],
        summary="Filter options for the archive drawer",
        description=(
            "Values present among browsable (not claimed) pieces, with counts. `availability` "
            "counts every public piece by where it stands: on the rail, on hold, claimed."
        ),
        responses={200: FacetsSerializer},
        auth=[],
    )
    def get(self, request):
        public = services.public_accessions().order_by()
        pieces = public.exclude(status=AccessionStatus.CLAIMED)
        prices = pieces.aggregate(price_min=Min("price_kes"), price_max=Max("price_kes"))
        drops = (
            pieces.filter(drop__isnull=False)
            .values("drop__number")
            .annotate(count=Count("pk"))
            .order_by("-drop__number")
        )
        data = {
            "availability": [
                {"value": "on_rail", "count": public.filter(status__in=ON_RAIL).count()},
                {"value": "on_hold", "count": public.filter(status=AccessionStatus.HELD).count()},
                {
                    "value": "claimed",
                    "count": public.filter(status=AccessionStatus.CLAIMED).count(),
                },
            ],
            "category": _counts(pieces, "category"),
            "chest_band": _counts(pieces, "chest_band"),
            "condition": _counts(pieces, "condition_grade"),
            "brand": _text_counts(pieces, "brand"),
            "colour": _text_counts(pieces, "colour"),
            "era": _text_counts(pieces, "era"),
            "drop": [{"value": str(row["drop__number"]), "count": row["count"]} for row in drops],
            **prices,
        }
        return Response(FacetsSerializer(data).data)


def _public_drop_queryset():
    return (
        services.public_drops()
        .annotate(piece_count=Count("accessions", filter=Q(accessions__status__in=SALE_STATUSES)))
        .order_by("-number")
    )


class PublicDropListView(generics.ListAPIView):
    authentication_classes: list = []
    permission_classes: list = []
    serializer_class = PublicDropSerializer
    filter_backends: list = []

    def get_queryset(self):
        return _public_drop_queryset()

    @extend_schema(
        tags=[CATALOG_TAG],
        summary="Drops, newest first",
        description="Scheduled drops appear with their release time before their pieces do.",
        auth=[],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PulseView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(
        tags=[CATALOG_TAG],
        summary="Live strip: next drop and how busy the rail is",
        description=(
            "`next_drop` is the soonest scheduled drop that has not opened yet, or null. "
            "`on_rail` counts public pieces for sale (including due scheduled ones); `on_hold` "
            "counts pieces held right now."
        ),
        responses={200: PulseSerializer},
        auth=[],
    )
    def get(self, request):
        now = timezone.now()
        next_drop = (
            _public_drop_queryset()
            .filter(status=DropStatus.SCHEDULED, release_at__gt=now)
            .order_by("release_at")
            .first()
        )
        public = services.public_accessions(now)
        payload = {
            "next_drop": next_drop,
            "on_rail": public.exclude(
                status__in=[AccessionStatus.HELD, AccessionStatus.CLAIMED]
            ).count(),
            "on_hold": public.filter(status=AccessionStatus.HELD).count(),
        }
        return Response(PulseSerializer(payload, context={"request": request}).data)


class PublicDropDetailView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(
        tags=[CATALOG_TAG],
        summary="One drop by number",
        description="List its pieces with `GET /catalog/accessions/?drop={number}`.",
        responses={200: PublicDropSerializer, 404: NOT_FOUND},
        auth=[],
    )
    def get(self, request, number: int):
        drop = get_object_or_404(_public_drop_queryset(), number=number)
        return Response(PublicDropSerializer(drop).data)


# Admin: accessions


class AdminAccessionListCreateView(CatalogWriterMixin, generics.ListAPIView):
    serializer_class = AdminAccessionListSerializer
    filterset_class = AdminAccessionFilter

    def get_queryset(self):
        return (
            Accession.objects.select_related("drop")
            .prefetch_related("images")
            .annotate(image_count=Count("images"))
            .order_by("-number")
        )

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="List every piece, any status",
        responses={200: AdminAccessionListSerializer(many=True), 401: NOT_SIGNED_IN},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Start a draft and take the next archive number",
        request=AccessionWriteSerializer,
        responses={
            201: AdminAccessionSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
        },
    )
    def post(self, request):
        serializer = AccessionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        accession = services.create_accession(actor=request.user, **serializer.validated_data)
        response = _admin_detail(accession, request)
        response.status_code = status.HTTP_201_CREATED
        return response


class AdminAccessionDetailView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="One piece with photos, flaws and publishing problems",
        responses={200: AdminAccessionSerializer, 401: NOT_SIGNED_IN, 404: NOT_FOUND},
    )
    def get(self, request, pk: int):
        return _admin_detail(get_object_or_404(Accession, pk=pk), request)

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Edit a piece",
        description="Changing the category clears category extras unless new ones are sent.",
        request=AccessionWriteSerializer,
        responses={
            200: AdminAccessionSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def patch(self, request, pk: int):
        accession = get_object_or_404(Accession, pk=pk)
        serializer = AccessionWriteSerializer(accession, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update_accession(accession, **serializer.validated_data)
        return _admin_detail(accession, request)

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Delete a draft",
        description="The archive number is not reused.",
        responses={
            204: None,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def delete(self, request, pk: int):
        services.delete_accession(get_object_or_404(Accession, pk=pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


_TRANSITION_RESPONSES = {
    200: AdminAccessionSerializer,
    400: OpenApiResponse(description="Missing details; `fields` lists what to fix"),
    401: NOT_SIGNED_IN,
    403: WRITER_REQUIRED,
    404: NOT_FOUND,
    409: CONFLICT,
}


class AdminAccessionPublishView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Publish now",
        request=None,
        responses=_TRANSITION_RESPONSES,
    )
    def post(self, request, pk: int):
        accession = services.publish_accession(get_object_or_404(Accession, pk=pk))
        return _admin_detail(accession, request)


class AdminAccessionScheduleView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Schedule for later",
        description=(
            "A piece in a drop takes the drop's release time and `release_at` is ignored. "
            "Otherwise `release_at` is required and must be in the future."
        ),
        request=ScheduleSerializer,
        responses=_TRANSITION_RESPONSES,
    )
    def post(self, request, pk: int):
        serializer = ScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        accession = services.schedule_accession(
            get_object_or_404(Accession, pk=pk),
            release_at=serializer.validated_data.get("release_at"),
        )
        return _admin_detail(accession, request)


class AdminAccessionWithdrawView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Take a piece off the archive",
        request=None,
        responses=_TRANSITION_RESPONSES,
    )
    def post(self, request, pk: int):
        accession = services.withdraw_accession(get_object_or_404(Accession, pk=pk))
        return _admin_detail(accession, request)


# Admin: images and flaws


class AdminImageCreateView(CatalogWriterMixin, APIView):
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Upload a photo",
        description=(
            "JPEG, PNG or WebP up to 15 MB. Metadata is stripped and the photo is re-encoded "
            "as JPEG with a long edge of at most 2400 px."
        ),
        request={"multipart/form-data": ImageUploadSerializer},
        responses={
            201: ImageSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def post(self, request, pk: int):
        accession = get_object_or_404(Accession, pk=pk)
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        image = services.add_image(
            accession, upload=data["file"], kind=data["kind"], alt_text=data.get("alt_text", "")
        )
        return Response(
            ImageSerializer(image, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminImageOrderView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Reorder photos",
        request=ImageOrderSerializer,
        responses={
            200: ImageSerializer(many=True),
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def post(self, request, pk: int):
        accession = get_object_or_404(Accession, pk=pk)
        serializer = ImageOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        images = services.reorder_images(accession, serializer.validated_data["ids"])
        return Response(ImageSerializer(images, many=True, context={"request": request}).data)


class AdminImageDetailView(CatalogWriterMixin, APIView):
    def _get(self, pk: int, image_id: int) -> AccessionImage:
        return get_object_or_404(
            AccessionImage.objects.select_related("accession"), pk=image_id, accession_id=pk
        )

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Change a photo's kind or alt text",
        request=ImageUpdateSerializer,
        responses={
            200: ImageSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def patch(self, request, pk: int, image_id: int):
        image = self._get(pk, image_id)
        serializer = ImageUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        image = services.update_image(image, **serializer.validated_data)
        return Response(ImageSerializer(image, context={"request": request}).data)

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Remove a photo",
        responses={
            204: None,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def delete(self, request, pk: int, image_id: int):
        services.delete_image(self._get(pk, image_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminFlawCreateView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="List a flaw",
        request=FlawWriteSerializer,
        responses={
            201: FlawSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def post(self, request, pk: int):
        accession = get_object_or_404(Accession, pk=pk)
        serializer = FlawWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        flaw = services.add_flaw(accession, **serializer.validated_data)
        return Response(FlawSerializer(flaw).data, status=status.HTTP_201_CREATED)


class AdminFlawDetailView(CatalogWriterMixin, APIView):
    def _get(self, pk: int, flaw_id: int) -> Flaw:
        return get_object_or_404(
            Flaw.objects.select_related("accession"), pk=flaw_id, accession_id=pk
        )

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Edit a flaw",
        request=FlawWriteSerializer,
        responses={
            200: FlawSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def patch(self, request, pk: int, flaw_id: int):
        flaw = self._get(pk, flaw_id)
        serializer = FlawWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        flaw = services.update_flaw(flaw, **serializer.validated_data)
        return Response(FlawSerializer(flaw).data)

    @extend_schema(
        tags=[ADMIN_CATALOG_TAG],
        summary="Remove a flaw",
        responses={
            204: None,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def delete(self, request, pk: int, flaw_id: int):
        services.delete_flaw(self._get(pk, flaw_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


# Admin: drops


def _admin_drop_queryset():
    return Drop.objects.annotate(
        piece_count=Count("accessions", filter=Q(accessions__status__in=SALE_STATUSES))
    ).order_by("-number")


def _drop_response(drop: Drop, code: int = status.HTTP_200_OK) -> Response:
    return Response(AdminDropSerializer(_admin_drop_queryset().get(pk=drop.pk)).data, status=code)


class AdminDropListCreateView(CatalogWriterMixin, generics.ListAPIView):
    serializer_class = AdminDropSerializer
    filter_backends: list = []

    def get_queryset(self):
        return _admin_drop_queryset()

    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="List drops, any status",
        responses={200: AdminDropSerializer(many=True), 401: NOT_SIGNED_IN},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="Start a draft drop and take the next drop number",
        request=DropWriteSerializer,
        responses={
            201: AdminDropSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
        },
    )
    def post(self, request):
        serializer = DropWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        drop = services.create_drop(**serializer.validated_data)
        return _drop_response(drop, status.HTTP_201_CREATED)


class AdminDropDetailView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="One drop",
        responses={200: AdminDropSerializer, 401: NOT_SIGNED_IN, 404: NOT_FOUND},
    )
    def get(self, request, pk: int):
        return _drop_response(get_object_or_404(Drop, pk=pk))

    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="Edit a drop's title or intro",
        request=DropWriteSerializer,
        responses={
            200: AdminDropSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
        },
    )
    def patch(self, request, pk: int):
        drop = get_object_or_404(Drop, pk=pk)
        serializer = DropWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return _drop_response(services.update_drop(drop, **serializer.validated_data))

    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="Delete a draft drop",
        description="Pieces assigned to it are detached, not deleted.",
        responses={
            204: None,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def delete(self, request, pk: int):
        services.delete_drop(get_object_or_404(Drop, pk=pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminDropScheduleView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="Set or move a drop's release time",
        description="Pieces already scheduled into the drop move with it.",
        request=DropScheduleSerializer,
        responses={
            200: AdminDropSerializer,
            400: VALIDATION,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
            409: CONFLICT,
        },
    )
    def post(self, request, pk: int):
        serializer = DropScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        drop = services.schedule_drop(
            get_object_or_404(Drop, pk=pk), release_at=serializer.validated_data["release_at"]
        )
        return _drop_response(drop)


class AdminDropReleaseView(CatalogWriterMixin, APIView):
    @extend_schema(
        tags=[ADMIN_DROPS_TAG],
        summary="Release a drop now",
        description="Every piece scheduled into the drop goes live with it.",
        request=None,
        responses={
            200: AdminDropSerializer,
            401: NOT_SIGNED_IN,
            403: WRITER_REQUIRED,
            404: NOT_FOUND,
        },
    )
    def post(self, request, pk: int):
        return _drop_response(services.release_drop(get_object_or_404(Drop, pk=pk)))
