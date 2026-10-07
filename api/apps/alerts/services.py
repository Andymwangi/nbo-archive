from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.alerts.models import CONSENT_VERSION, DropAlertSubscriber


def subscribe(*, phone: str = "", email: str = "", source: str = "") -> DropAlertSubscriber:
    """Add someone to the drop list, or renew their consent if they are already on it.

    A person may sign up with a phone, an email, or both; an existing record matching either is
    updated so one person never ends up as two rows."""
    email = email.strip().lower()
    match = Q()
    if phone:
        match |= Q(phone=phone)
    if email:
        match |= Q(email__iexact=email)

    for _ in range(2):
        try:
            with transaction.atomic():
                existing = DropAlertSubscriber.objects.select_for_update().filter(match).first()
                now = timezone.now()
                if existing is None:
                    return DropAlertSubscriber.objects.create(
                        phone=phone,
                        email=email,
                        consented_at=now,
                        consent_version=CONSENT_VERSION,
                        source=source[:40],
                    )
                existing.phone = existing.phone or phone
                existing.email = existing.email or email
                existing.consented_at = now
                existing.consent_version = CONSENT_VERSION
                existing.unsubscribed_at = None
                existing.save()
                return existing
        except IntegrityError:
            # A simultaneous sign-up with the same details won the insert; retry as an update.
            continue
    raise RuntimeError("Could not record the drop alert sign-up.")


def unsubscribe(*, phone: str = "", email: str = "") -> int:
    """Take someone off the drop list. Returns how many records stopped receiving alerts."""
    match = Q()
    if phone:
        match |= Q(phone=phone)
    if email:
        match |= Q(email__iexact=email.strip())
    if not match:
        return 0
    return DropAlertSubscriber.objects.filter(match, unsubscribed_at__isnull=True).update(
        unsubscribed_at=timezone.now(), updated_at=timezone.now()
    )
