from django.core.cache import cache
from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes: list = []

    @extend_schema(
        tags=["System"],
        summary="Liveness and dependency check",
        responses={
            200: inline_serializer(
                "Health",
                {"database": serializers.CharField(), "cache": serializers.CharField()},
            ),
            503: inline_serializer(
                "HealthDegraded",
                {"database": serializers.CharField(), "cache": serializers.CharField()},
            ),
        },
    )
    def get(self, request):
        result = {"database": "ok", "cache": "ok"}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            result["database"] = "unavailable"
        try:
            cache.set("health:ping", "1", 5)
            if cache.get("health:ping") != "1":
                result["cache"] = "unavailable"
        except Exception:
            result["cache"] = "unavailable"
        healthy = all(v == "ok" for v in result.values())
        return Response(
            result, status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        )
