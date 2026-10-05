from datetime import timedelta

from celery import shared_task
from django.core.mail import send_mail
from django.core.management import call_command
from django.db.models import Q
from django.utils import timezone

from apps.accounts.emails import magic_link_message
from apps.accounts.models import MagicLinkToken

STALE_LINK_RETENTION = timedelta(days=7)


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def send_magic_link_email(email: str, name: str, raw_token: str) -> None:
    subject, body = magic_link_message(name, raw_token)
    send_mail(subject, body, None, [email], fail_silently=False)


@shared_task
def purge_stale_magic_links() -> int:
    """Delete links that expired or were used more than a week ago."""
    cutoff = timezone.now() - STALE_LINK_RETENTION
    deleted, _ = MagicLinkToken.objects.filter(
        Q(expires_at__lt=cutoff) | Q(used_at__lt=cutoff)
    ).delete()
    return deleted


@shared_task
def flush_expired_jwt() -> None:
    """Remove expired outstanding and blacklisted refresh tokens."""
    call_command("flushexpiredtokens")
