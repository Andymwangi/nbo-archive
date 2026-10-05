from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts import services
from apps.accounts.models import AdminRole, AdminUser
from apps.accounts.serializers import (
    AccessRefreshSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    DetailSerializer,
    MagicLinkRequestSerializer,
    MagicLinkVerifySerializer,
    RefreshRequestSerializer,
    TokenPairSerializer,
)
from apps.common.permissions import HasAdminRole

AUTH_TAG = "Auth"
USERS_TAG = "Admin users"

NOT_SIGNED_IN = OpenApiResponse(description="Not signed in")
OWNER_REQUIRED = OpenApiResponse(description="Owner role required")


def _client_meta(request) -> dict:
    return {
        "ip": request.META.get("REMOTE_ADDR"),
        "user_agent": request.META.get("HTTP_USER_AGENT", ""),
    }


class MagicLinkRequestView(APIView):
    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "magic_link"

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Request a sign-in link",
        description=(
            "Emails a single-use sign-in link if the address belongs to an active admin. "
            "The response is identical whether or not the account exists."
        ),
        request=MagicLinkRequestSerializer,
        responses={
            202: DetailSerializer,
            400: OpenApiResponse(description="Malformed email"),
            429: OpenApiResponse(description="Too many requests"),
        },
        auth=[],
    )
    def post(self, request):
        serializer = MagicLinkRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_magic_link(serializer.validated_data["email"], **_client_meta(request))
        return Response(
            {"detail": "If that address is on the staff list, a link is on its way."},
            status=status.HTTP_202_ACCEPTED,
        )


class MagicLinkVerifyView(APIView):
    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "magic_link_verify"

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Exchange a sign-in link for tokens",
        request=MagicLinkVerifySerializer,
        responses={
            200: TokenPairSerializer,
            400: OpenApiResponse(description="Malformed token"),
            401: OpenApiResponse(description="Link invalid, used or expired"),
            429: OpenApiResponse(description="Too many requests"),
        },
        auth=[],
    )
    def post(self, request):
        serializer = MagicLinkVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issued = services.consume_magic_link(serializer.validated_data["token"])
        payload = {"access": issued.access, "refresh": issued.refresh, "user": issued.user}
        return Response(TokenPairSerializer(payload).data)


@extend_schema(
    tags=[AUTH_TAG],
    summary="Rotate a refresh token",
    request=RefreshRequestSerializer,
    responses={
        200: AccessRefreshSerializer,
        401: OpenApiResponse(description="Refresh token invalid, expired or revoked"),
    },
    auth=[],
)
class RefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Revoke a refresh token",
        request=RefreshRequestSerializer,
        responses={
            200: DetailSerializer,
            400: OpenApiResponse(description="Token invalid or already revoked"),
            401: NOT_SIGNED_IN,
        },
    )
    def post(self, request):
        serializer = RefreshRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.revoke_refresh_token(serializer.validated_data["refresh"])
        return Response({"detail": "Signed out."})


class MeView(APIView):
    permission_classes = [HasAdminRole]

    @extend_schema(
        tags=[AUTH_TAG],
        summary="Current admin",
        responses={200: AdminUserSerializer, 401: NOT_SIGNED_IN},
    )
    def get(self, request):
        return Response(AdminUserSerializer(request.user).data)


class AdminUserListCreateView(generics.ListAPIView):
    permission_classes = [HasAdminRole]
    allowed_roles = [AdminRole.OWNER]
    serializer_class = AdminUserSerializer
    queryset = AdminUser.objects.all()

    @extend_schema(
        tags=[USERS_TAG],
        summary="List admin users",
        responses={200: AdminUserSerializer(many=True), 401: NOT_SIGNED_IN, 403: OWNER_REQUIRED},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=[USERS_TAG],
        summary="Add an admin user and email them a sign-in link",
        request=AdminUserCreateSerializer,
        responses={
            201: AdminUserSerializer,
            400: OpenApiResponse(description="Validation error"),
            401: NOT_SIGNED_IN,
            403: OWNER_REQUIRED,
        },
    )
    def post(self, request):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.create_admin_user(**serializer.validated_data)
        services.request_magic_link(user.email, **_client_meta(request))
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    permission_classes = [HasAdminRole]
    allowed_roles = [AdminRole.OWNER]

    @extend_schema(
        tags=[USERS_TAG],
        summary="Get an admin user",
        responses={
            200: AdminUserSerializer,
            401: NOT_SIGNED_IN,
            403: OWNER_REQUIRED,
            404: OpenApiResponse(description="Not found"),
        },
    )
    def get(self, request, pk: int):
        return Response(AdminUserSerializer(get_object_or_404(AdminUser, pk=pk)).data)

    @extend_schema(
        tags=[USERS_TAG],
        summary="Update an admin user's details, role or active state",
        request=AdminUserUpdateSerializer,
        responses={
            200: AdminUserSerializer,
            400: OpenApiResponse(description="Validation error"),
            401: NOT_SIGNED_IN,
            403: OWNER_REQUIRED,
            404: OpenApiResponse(description="Not found"),
        },
    )
    def patch(self, request, pk: int):
        user = get_object_or_404(AdminUser, pk=pk)
        serializer = AdminUserUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = services.update_admin_user(user, actor=request.user, **serializer.validated_data)
        return Response(AdminUserSerializer(user).data)
