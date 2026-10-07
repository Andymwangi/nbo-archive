from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AdminRole
from apps.accounts.serializers import DetailSerializer
from apps.alerts import services
from apps.alerts.models import DropAlertSubscriber
from apps.alerts.serializers import (
    SubscriberSerializer,
    SubscribeSerializer,
    UnsubscribeSerializer,
)
from apps.common.client_ip import ClientAnonRateThrottle, ClientScopedRateThrottle
from apps.common.permissions import HasAdminRole

ALERTS_TAG = "Drop alerts"


class PublicAlertView(APIView):
    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes = [ClientAnonRateThrottle, ClientScopedRateThrottle]
    throttle_scope = "alerts"


class SubscribeView(PublicAlertView):
    @extend_schema(
        tags=[ALERTS_TAG],
        summary="Join the drop list",
        description=(
            "A WhatsApp number (Kenyan mobile), an email, or both, with `consent: true`. The "
            "response is the same whether or not the person was already on the list."
        ),
        request=SubscribeSerializer,
        responses={
            202: DetailSerializer,
            400: OpenApiResponse(description="No contact, a bad number or email, or no consent"),
            429: OpenApiResponse(description="Too many requests"),
        },
        auth=[],
    )
    def post(self, request):
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.subscribe(
            phone=data.get("phone", ""), email=data.get("email", ""), source=data.get("source", "")
        )
        return Response({"detail": "You are on the drop list."}, status=status.HTTP_202_ACCEPTED)


class UnsubscribeView(PublicAlertView):
    @extend_schema(
        tags=[ALERTS_TAG],
        summary="Leave the drop list",
        description="Same response whether or not the details were on the list.",
        request=UnsubscribeSerializer,
        responses={
            202: DetailSerializer,
            400: OpenApiResponse(description="No contact given"),
            429: OpenApiResponse(description="Too many requests"),
        },
        auth=[],
    )
    def post(self, request):
        serializer = UnsubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.unsubscribe(phone=data.get("phone", ""), email=data.get("email", ""))
        return Response(
            {"detail": "You will not get drop alerts any more."}, status=status.HTTP_202_ACCEPTED
        )


class AdminSubscriberListView(generics.ListAPIView):
    permission_classes = [HasAdminRole]
    allowed_roles = [AdminRole.OWNER]
    serializer_class = SubscriberSerializer
    filter_backends: list = []

    def get_queryset(self):
        queryset = DropAlertSubscriber.objects.all()
        if self.request.query_params.get("include_unsubscribed") != "true":
            queryset = queryset.filter(unsubscribed_at__isnull=True)
        return queryset

    @extend_schema(
        tags=[ALERTS_TAG],
        summary="People on the drop list",
        description=(
            "Owner only. Unsubscribed people are left out unless `include_unsubscribed=true`."
        ),
        responses={
            200: SubscriberSerializer(many=True),
            401: OpenApiResponse(description="Not signed in"),
            403: OpenApiResponse(description="Owner role required"),
        },
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
