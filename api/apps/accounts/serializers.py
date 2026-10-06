from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import AdminRole, AdminUser
from apps.common.phone import normalise_kenyan_phone


def _validate_optional_phone(value: str) -> str:
    if not value:
        return ""
    try:
        return normalise_kenyan_phone(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages[0]) from exc


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminUser
        fields = ["id", "email", "name", "phone", "role", "is_active", "last_login", "created_at"]
        read_only_fields = fields


class MagicLinkRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class MagicLinkVerifySerializer(serializers.Serializer):
    token = serializers.CharField(min_length=20, max_length=128, trim_whitespace=True)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = AdminUserSerializer()


class RefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class AccessSerializer(serializers.Serializer):
    access = serializers.CharField()


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class AdminUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=AdminRole.choices)

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if AdminUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An admin with this email already exists.")
        return value

    def validate_phone(self, value: str) -> str:
        return _validate_optional_phone(value)


class AdminUserUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    phone = serializers.CharField(max_length=24, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=AdminRole.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_phone(self, value: str) -> str:
        return _validate_optional_phone(value)
