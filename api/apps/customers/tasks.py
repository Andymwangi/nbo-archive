from datetime import timedelta

from celery import shared_task
from django.db.models import Q
from django.utils import timezone

from apps.customers.delivery import deliver_code
from apps.customers.models import CustomerSession, SignInCode


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def send_sign_in_code(channel: str, destination: str, code: str) -> None:
    deliver_code(channel, destination, code)


@shared_task
def purge_customer_auth() -> tuple[int, int]:
    """Delete sign-in codes older than a day and sessions that ended over a month ago."""
    now = timezone.now()
    codes, _ = SignInCode.objects.filter(created_at__lt=now - timedelta(days=1)).delete()
    month = now - timedelta(days=30)
    sessions, _ = CustomerSession.objects.filter(
        Q(expires_at__lt=month) | Q(revoked_at__lt=month)
    ).delete()
    return codes, sessions
