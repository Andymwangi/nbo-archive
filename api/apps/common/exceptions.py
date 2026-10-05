"""Every API error leaves as {"error": {"code", "message", "fields"?}} so the web client
can branch on a stable code instead of parsing DRF's varied default shapes."""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ConflictError(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The resource is not in a state that allows this action."
    default_code = "conflict"


class InvalidCredentialError(exceptions.APIException):
    """401 for credential checks on endpoints that have no authenticator (e.g. magic-link
    redemption), where DRF would otherwise downgrade AuthenticationFailed to 403."""

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "These credentials are invalid."
    default_code = "invalid_credentials"


class GoneError(exceptions.APIException):
    status_code = status.HTTP_410_GONE
    default_detail = "This resource is no longer available."
    default_code = "gone"


def _first_message(detail) -> str:
    if isinstance(detail, list) and detail:
        return _first_message(detail[0])
    if isinstance(detail, dict) and detail:
        return _first_message(next(iter(detail.values())))
    return str(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = getattr(exc, "detail", response.data)
    codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None

    if isinstance(codes, str):
        code = codes
    elif isinstance(detail, dict) and "code" in detail:
        # SimpleJWT raises {"detail": ..., "code": "token_not_valid", "messages": [...]}.
        code = str(detail["code"])
        detail = detail.get("detail", detail)
    else:
        code = "invalid"

    body: dict = {"code": code}
    if isinstance(exc, exceptions.ValidationError):
        body["code"] = "validation_error"
        body["message"] = _first_message(detail)
        body["fields"] = detail if isinstance(detail, dict) else {"non_field_errors": detail}
    else:
        body["message"] = _first_message(detail)

    return Response({"error": body}, status=response.status_code, headers=response.headers)
