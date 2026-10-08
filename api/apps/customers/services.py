"""Customer sign-in by one-time code, and the sessions it creates.

A code is six digits, lives for CUSTOMER_CODE_TTL_MINUTES, allows MAX_ATTEMPTS wrong guesses,
and is stored only as an HMAC keyed with the server secret, so a copy of the database cannot be
brute-forced into working codes. Requesting a new code retires the previous one for the same
address, so only the newest code in the inbox works.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.common.exceptions import InvalidCredentialError
from apps.customers.models import CodeChannel, Customer, CustomerSession, SignInCode
from apps.customers.tasks import send_sign_in_code

MAX_ATTEMPTS = 5
MAX_CODES_PER_WINDOW = 3
CODE_WINDOW = timedelta(minutes=15)


@dataclass(frozen=True)
class SignedIn:
    customer: Customer
    token: str


def _code_hash(destination: str, code: str) -> str:
    message = f"{destination}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _invalid() -> InvalidCredentialError:
    return InvalidCredentialError(
        "That code is not right, or it has expired. Ask for a new one.", code="invalid_code"
    )


def request_code(*, email: str, ip: str | None) -> None:
    """Send a sign-in code to `email`. Anyone may ask: the first successful sign-in creates the
    customer. Returns silently either way, so the endpoint reveals nothing about who has an
    account."""
    destination = email.strip().lower()
    now = timezone.now()
    recent = SignInCode.objects.filter(
        destination=destination, created_at__gte=now - CODE_WINDOW
    ).count()
    if recent >= MAX_CODES_PER_WINDOW:
        return

    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        SignInCode.objects.filter(destination=destination, used_at__isnull=True).update(
            used_at=now, updated_at=now
        )
        SignInCode.objects.create(
            channel=CodeChannel.EMAIL,
            destination=destination,
            code_hash=_code_hash(destination, code),
            expires_at=now + timedelta(minutes=settings.CUSTOMER_CODE_TTL_MINUTES),
            requested_ip=ip,
        )
        transaction.on_commit(lambda: send_sign_in_code.delay(CodeChannel.EMAIL, destination, code))


def verify_code(*, email: str, code: str, user_agent: str = "") -> SignedIn:
    """Exchange a code for a session. Each code works once; wrong guesses are counted and the
    code dies after MAX_ATTEMPTS of them."""
    destination = email.strip().lower()
    now = timezone.now()
    wrong_guess = False
    with transaction.atomic():
        live = (
            SignInCode.objects.select_for_update()
            .filter(destination=destination, used_at__isnull=True, expires_at__gt=now)
            .order_by("-created_at")
            .first()
        )
        if live is None or live.attempts >= MAX_ATTEMPTS:
            raise _invalid()
        if not hmac.compare_digest(live.code_hash, _code_hash(destination, code.strip())):
            live.attempts += 1
            live.save(update_fields=["attempts", "updated_at"])
            wrong_guess = True
        else:
            live.used_at = now
            live.save(update_fields=["used_at", "updated_at"])
            customer = Customer.objects.filter(email__iexact=destination).first()
            if customer is None:
                customer = Customer(email=destination)
            customer.email_verified_at = customer.email_verified_at or now
            customer.last_signed_in_at = now
            customer.save()
            token = secrets.token_urlsafe(32)
            CustomerSession.objects.create(
                customer=customer,
                token_hash=_token_hash(token),
                expires_at=now + timedelta(days=settings.CUSTOMER_SESSION_DAYS),
                user_agent=user_agent[:255],
            )
    # Raised outside the transaction so the counted wrong guess is committed, not rolled back.
    if wrong_guess:
        raise _invalid()
    return SignedIn(customer=customer, token=token)


def authenticate(token: str) -> Customer | None:
    """The customer behind a session token, or None when it is unknown, expired or revoked."""
    if not token:
        return None
    now = timezone.now()
    session = (
        CustomerSession.objects.select_related("customer")
        .filter(token_hash=_token_hash(token), revoked_at__isnull=True, expires_at__gt=now)
        .first()
    )
    if session is None:
        return None
    # Recording every request would write on every page view; once an hour is enough.
    if session.last_used_at is None or session.last_used_at < now - timedelta(hours=1):
        CustomerSession.objects.filter(pk=session.pk).update(last_used_at=now)
    return session.customer


def sign_out(token: str) -> None:
    now = timezone.now()
    CustomerSession.objects.filter(token_hash=_token_hash(token), revoked_at__isnull=True).update(
        revoked_at=now, updated_at=now
    )


def update_profile(customer: Customer, **changes) -> Customer:
    for field, value in changes.items():
        setattr(customer, field, value)
    customer.save()
    return customer
