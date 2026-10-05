from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import AdminRole, AdminUser, MagicLinkToken
from apps.accounts.tasks import send_magic_link_email
from apps.accounts.tokens import generate_token, hash_token
from apps.common.exceptions import InvalidCredentialError

# Caps how many links one address can be sent in the window, independent of IP throttling,
# so a single inbox cannot be flooded from rotating addresses.
MAX_LINKS_PER_WINDOW = 3
LINK_WINDOW = timedelta(minutes=15)


@dataclass(frozen=True)
class IssuedTokens:
    access: str
    refresh: str
    user: AdminUser


def request_magic_link(email: str, *, ip: str | None, user_agent: str) -> None:
    """Send a sign-in link if `email` belongs to an active admin.

    Always returns silently so the endpoint cannot be used to discover which
    addresses have accounts."""
    user = AdminUser.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if user is None:
        return

    now = timezone.now()
    recent = MagicLinkToken.objects.filter(user=user, created_at__gte=now - LINK_WINDOW).count()
    if recent >= MAX_LINKS_PER_WINDOW:
        return

    raw, digest = generate_token()
    with transaction.atomic():
        MagicLinkToken.objects.create(
            user=user,
            token_hash=digest,
            expires_at=now + timedelta(minutes=settings.MAGIC_LINK_TTL_MINUTES),
            requested_ip=ip,
            user_agent=user_agent[:255],
        )
        transaction.on_commit(lambda: send_magic_link_email.delay(user.email, user.name, raw))


def consume_magic_link(raw_token: str) -> IssuedTokens:
    """Exchange a raw magic-link token for a JWT pair. Each token works exactly once."""
    invalid = InvalidCredentialError(
        "This link is invalid or has expired. Request a new one.", code="invalid_link"
    )
    with transaction.atomic():
        link = (
            MagicLinkToken.objects.select_for_update()
            .select_related("user")
            .filter(token_hash=hash_token(raw_token))
            .first()
        )
        if link is None or not link.is_usable or not link.user.is_active:
            raise invalid

        now = timezone.now()
        link.used_at = now
        link.save(update_fields=["used_at", "updated_at"])
        # A successful sign-in retires every other outstanding link for this user.
        MagicLinkToken.objects.filter(user=link.user, used_at__isnull=True).exclude(
            pk=link.pk
        ).update(used_at=now, updated_at=now)
        return issue_tokens(link.user)


def issue_tokens(user: AdminUser) -> IssuedTokens:
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    user.last_login = timezone.now()
    user.save(update_fields=["last_login", "updated_at"])
    return IssuedTokens(access=str(refresh.access_token), refresh=str(refresh), user=user)


def revoke_refresh_token(raw_refresh: str) -> None:
    try:
        RefreshToken(raw_refresh).blacklist()
    except TokenError as exc:
        raise exceptions.ValidationError(
            {"refresh": ["Token is invalid or already revoked."]}
        ) from exc


def _active_owner_count(exclude: AdminUser | None = None) -> int:
    qs = AdminUser.objects.filter(role=AdminRole.OWNER, is_active=True)
    if exclude is not None:
        qs = qs.exclude(pk=exclude.pk)
    return qs.count()


def create_admin_user(*, email: str, name: str, role: str, phone: str = "") -> AdminUser:
    """Create a staff account with no password. They sign in through a magic link."""
    return AdminUser.objects.create_user(email=email, name=name, role=role, phone=phone)


def update_admin_user(user: AdminUser, *, actor: AdminUser, **changes) -> AdminUser:
    if user.pk == actor.pk and changes.get("is_active") is False:
        raise exceptions.ValidationError({"is_active": ["You cannot deactivate your own account."]})

    with transaction.atomic():
        # Lock the owner rows so two concurrent demotions cannot both pass the check.
        list(AdminUser.objects.select_for_update().filter(role=AdminRole.OWNER, is_active=True))
        user.refresh_from_db()
        loses_owner = (
            user.role == AdminRole.OWNER
            and user.is_active
            and (
                changes.get("role", AdminRole.OWNER) != AdminRole.OWNER
                or changes.get("is_active") is False
            )
        )
        if loses_owner and _active_owner_count(exclude=user) == 0:
            raise exceptions.ValidationError(
                {"role": ["The archive needs at least one active owner."]}
            )

        for field, value in changes.items():
            setattr(user, field, value)
        user.save()
    return user
