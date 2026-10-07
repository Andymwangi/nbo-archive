from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.alerts.models import DropAlertSubscriber
from apps.common.phone import normalise_kenyan_phone


class SubscribeSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True)
    consent = serializers.BooleanField()
    source = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        if not value:
            return ""
        try:
            return normalise_kenyan_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc

    def validate_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("Tick the box so we are allowed to message you.")
        return value

    def validate(self, attrs):
        if not attrs.get("phone") and not attrs.get("email"):
            raise serializers.ValidationError(
                {"phone": ["Add a WhatsApp number or an email address."]}
            )
        return attrs


class UnsubscribeSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True)

    validate_phone = SubscribeSerializer.validate_phone

    def validate(self, attrs):
        if not attrs.get("phone") and not attrs.get("email"):
            raise serializers.ValidationError(
                {"phone": ["Add the WhatsApp number or email you signed up with."]}
            )
        return attrs


class SubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = DropAlertSubscriber
        fields = [
            "id",
            "phone",
            "email",
            "consented_at",
            "consent_version",
            "source",
            "unsubscribed_at",
            "created_at",
        ]
        read_only_fields = fields
