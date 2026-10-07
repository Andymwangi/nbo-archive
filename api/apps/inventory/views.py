from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AdminRole
from apps.catalog.models import Accession
from apps.catalog.serializers import AdminAccessionSerializer
from apps.catalog.specs import parse_archive_no
from apps.common.client_ip import ClientAnonRateThrottle, ClientScopedRateThrottle
from apps.common.permissions import HasAdminRole
from apps.inventory import services
from apps.inventory.serializers import HoldSerializer, PlaceHoldSerializer, VisitorToken

HOLDS_TAG = "Holds"

VISITOR_HEADER = OpenApiParameter(
    name="X-Visitor-Token",
    location=OpenApiParameter.HEADER,
    required=True,
    description="The visitor's random key (32 to 128 URL-safe characters). Stored only hashed.",
)
CLOSED = OpenApiResponse(description="Holds are switched off (`holds_closed`)")
BAD_TOKEN = OpenApiResponse(description="Missing or malformed visitor token")


class VisitorHoldView(APIView):
    authentication_classes: list = []
    permission_classes: list = []


class HoldListCreateView(VisitorHoldView):
    throttle_classes = [ClientAnonRateThrottle, ClientScopedRateThrottle]
    throttle_scope = "hold"

    def get_throttles(self):
        # Reading your own holds is cheap and frequent (every page with the hold indicator);
        # only placing one counts against the hold rate.
        if self.request.method == "GET":
            return [ClientAnonRateThrottle()]
        return super().get_throttles()

    @extend_schema(
        tags=[HOLDS_TAG],
        summary="The visitor's active holds",
        parameters=[VISITOR_HEADER],
        responses={200: HoldSerializer(many=True), 400: BAD_TOKEN, 404: CLOSED},
        auth=[],
    )
    def get(self, request):
        services.ensure_open()
        token = VisitorToken.from_request(request)
        return Response(HoldSerializer(services.visitor_holds(token), many=True).data)

    @extend_schema(
        tags=[HOLDS_TAG],
        summary="Place a piece on hold",
        description=(
            "Reserves the piece for 15 minutes. Asking again for a piece this visitor already "
            "holds returns that hold with 200. Conflict codes: `piece_held` (someone else holds "
            "it), `not_for_sale`, `hold_limit` (three active holds already)."
        ),
        parameters=[VISITOR_HEADER],
        request=PlaceHoldSerializer,
        responses={
            201: HoldSerializer,
            200: HoldSerializer,
            400: BAD_TOKEN,
            404: OpenApiResponse(description="No such public piece, or holds are switched off"),
            409: OpenApiResponse(description="The piece cannot be held"),
            429: OpenApiResponse(description="Too many requests"),
        },
        auth=[],
    )
    def post(self, request):
        services.ensure_open()
        token = VisitorToken.from_request(request)
        serializer = PlaceHoldSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        number = parse_archive_no(serializer.validated_data["archive_no"])
        if number is None:
            raise exceptions.NotFound()
        hold, created = services.place_hold(number=number, token=token)
        return Response(
            HoldSerializer(hold).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class HoldDetailView(VisitorHoldView):
    @extend_schema(
        tags=[HOLDS_TAG],
        summary="Let go of a hold",
        description="Idempotent: releasing a hold that already ended still returns 204.",
        parameters=[VISITOR_HEADER],
        responses={
            204: OpenApiResponse(description="Released"),
            400: BAD_TOKEN,
            404: OpenApiResponse(description="Not this visitor's hold, or holds are off"),
        },
        auth=[],
    )
    def delete(self, request, pk: int):
        services.ensure_open()
        token = VisitorToken.from_request(request)
        services.release_hold(hold_id=pk, token=token)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminReleaseHoldView(APIView):
    permission_classes = [HasAdminRole]
    allowed_roles = [AdminRole.OWNER, AdminRole.EDITOR]

    @extend_schema(
        tags=["Admin catalog"],
        summary="Release a piece's active hold",
        description=(
            "Clears a stuck hold and puts the piece back on sale. A piece marked held with no "
            "active hold behind it is repaired the same way."
        ),
        request=None,
        responses={
            200: AdminAccessionSerializer,
            401: OpenApiResponse(description="Not signed in"),
            403: OpenApiResponse(description="Owner or editor role required"),
            404: OpenApiResponse(description="Not found"),
            409: OpenApiResponse(description="The piece is not on hold (`no_hold`)"),
        },
    )
    def post(self, request, pk: int):
        accession = get_object_or_404(Accession, pk=pk)
        services.staff_release(accession=accession, actor=request.user)
        fresh = (
            Accession.objects.select_related("drop", "created_by")
            .prefetch_related("images", "flaws")
            .get(pk=pk)
        )
        return Response(AdminAccessionSerializer(fresh, context={"request": request}).data)
