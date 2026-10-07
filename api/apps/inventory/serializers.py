from rest_framework import serializers

from apps.catalog.serializers import PublicAccessionCardSerializer
from apps.inventory.models import Hold

VISITOR_META_KEY = "HTTP_X_VISITOR_TOKEN"


class PlaceHoldSerializer(serializers.Serializer):
    archive_no = serializers.CharField(max_length=16)


class HoldSerializer(serializers.ModelSerializer):
    piece = PublicAccessionCardSerializer(source="accession", read_only=True)

    class Meta:
        model = Hold
        fields = ["id", "status", "expires_at", "created_at", "piece"]
        read_only_fields = fields


class VisitorToken(serializers.Serializer):
    """The visitor's random key, sent by the web server in the X-Visitor-Token header."""

    token = serializers.RegexField(
        r"^[A-Za-z0-9_-]{32,128}$",
        error_messages={"invalid": "Send a visitor token of 32 to 128 URL-safe characters."},
    )

    @classmethod
    def from_request(cls, request) -> str:
        serializer = cls(data={"token": request.META.get(VISITOR_META_KEY, "")})
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data["token"]
