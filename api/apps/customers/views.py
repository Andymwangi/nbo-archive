from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import DetailSerializer
from apps.common.client_ip import ClientAnonRateThrottle, ClientScopedRateThrottle, client_ip
from apps.customers import services
from apps.customers.serializers import (
    CustomerSerializer,
    ProfileSerializer,
    RequestCodeSerializer,
    SignedInSerializer,
    VerifyCodeSerializer,
)

CUSTOMERS_TAG = "Customers"
SESSION_META_KEY = "HTTP_X_CUSTOMER_SESSION"

CUSTOMER_HEADER = OpenApiParameter(
    name="X-Customer-Session",
    location=OpenApiParameter.HEADER,
    required=True,
    description="The customer's session token, sent by the web server from its httpOnly cookie.",
)
SIGNED_OUT = OpenApiResponse(description="No valid customer session (`not_signed_in`)")


class NotSignedIn(exceptions.APIException):
    status_code = 401
    default_detail = "Sign in to continue."
    default_code = "not_signed_in"


def _customer(request):
    customer = services.authenticate(request.META.get(SESSION_META_KEY, ""))
    if customer is None:
        raise NotSignedIn()
    return customer


class CustomerView(APIView):
    authentication_classes: list = []
    permission_classes: list = []


class RequestCodeView(CustomerView):
    throttle_classes = [ClientAnonRateThrottle, ClientScopedRateThrottle]
    throttle_scope = "customer_code"

    @extend_schema(
        tags=[CUSTOMERS_TAG],
        summary="Email a sign-in code",
        description=(
            "Sends a six-digit code to the address. The response is the same whether or not "
            "the address already has an account; the first sign-in creates it."
        ),
        request=RequestCodeSerializer,
        responses={202: DetailSerializer, 400: OpenApiResponse(description="Bad email")},
        auth=[],
    )
    def post(self, request):
        serializer = RequestCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_code(email=serializer.validated_data["email"], ip=client_ip(request))
        return Response(
            {"detail": "A code is on its way if the address can receive email."},
            status=status.HTTP_202_ACCEPTED,
        )


class VerifyCodeView(CustomerView):
    throttle_classes = [ClientAnonRateThrottle, ClientScopedRateThrottle]
    throttle_scope = "customer_verify"

    @extend_schema(
        tags=[CUSTOMERS_TAG],
        summary="Sign in with the emailed code",
        request=VerifyCodeSerializer,
        responses={
            200: SignedInSerializer,
            400: OpenApiResponse(description="Malformed code"),
            401: OpenApiResponse(description="Wrong, used or expired code (`invalid_code`)"),
        },
        auth=[],
    )
    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        signed_in = services.verify_code(
            email=serializer.validated_data["email"],
            code=serializer.validated_data["code"],
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response(
            SignedInSerializer({"token": signed_in.token, "customer": signed_in.customer}).data
        )


class MeView(CustomerView):
    @extend_schema(
        tags=[CUSTOMERS_TAG],
        summary="The signed-in customer",
        parameters=[CUSTOMER_HEADER],
        responses={200: CustomerSerializer, 401: SIGNED_OUT},
        auth=[],
    )
    def get(self, request):
        return Response(CustomerSerializer(_customer(request)).data)

    @extend_schema(
        tags=[CUSTOMERS_TAG],
        summary="Update name and phone",
        parameters=[CUSTOMER_HEADER],
        request=ProfileSerializer,
        responses={
            200: CustomerSerializer,
            400: OpenApiResponse(description="Bad phone"),
            401: SIGNED_OUT,
        },
        auth=[],
    )
    def patch(self, request):
        customer = _customer(request)
        serializer = ProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        customer = services.update_profile(customer, **serializer.validated_data)
        return Response(CustomerSerializer(customer).data)


class SignOutView(CustomerView):
    @extend_schema(
        tags=[CUSTOMERS_TAG],
        summary="End this session",
        description="Idempotent: an unknown or ended session still returns 204.",
        parameters=[CUSTOMER_HEADER],
        request=None,
        responses={204: OpenApiResponse(description="Signed out")},
        auth=[],
    )
    def post(self, request):
        services.sign_out(request.META.get(SESSION_META_KEY, ""))
        return Response(status=status.HTTP_204_NO_CONTENT)
