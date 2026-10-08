from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.common.phone import normalise_kenyan_phone
from apps.customers.models import Customer


class RequestCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    code = serializers.RegexField(
        r"^\s*\d{6}\s*$", error_messages={"invalid": "Enter the six-digit code from the email."}
    )


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["email", "name", "phone", "email_verified_at", "created_at"]
        read_only_fields = fields


class SignedInSerializer(serializers.Serializer):
    token = serializers.CharField()
    customer = CustomerSerializer()


class ProfileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        if not value:
            return ""
        try:
            return normalise_kenyan_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0]) from exc
