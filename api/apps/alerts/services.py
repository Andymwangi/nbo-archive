from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.alerts.models import CONSENT_VERSION, DropAlertSubscriber


def subscribe(*, phone: str = "", email: str = "", source: str = "") -> list[DropAlertSubscriber]:
    """Add someone to the drop list, or renew their consent if they are already on it.

    A person may sign up with a phone, an email, or both. When exactly one existing record
    matches, the new detail is added to it so one person stays one row. When the phone and the
    email already belong to two different records, both are renewed and nothing is merged:
    rewriting one onto the other would collide with the other record."""
    email = email.strip().lower()
    match = Q()
    if phone:
        match |= Q(phone=phone)
    if email:
        match |= Q(email__iexact=email)

    for _ in range(2):
        try:
            with transaction.atomic():
                existing = list(DropAlertSubscriber.objects.select_for_update().filter(match))
                now = timezone.now()
                if not existing:
                    return [
                        DropAlertSubscriber.objects.create(
                            phone=phone,
                            email=email,
                            consented_at=now,
                            consent_version=CONSENT_VERSION,
                            source=source[:40],
                        )
                    ]
                for record in existing:
                    if len(existing) == 1:
                        record.phone = record.phone or phone
                        record.email = record.email or email
                    record.consented_at = now
                    record.consent_version = CONSENT_VERSION
                    record.unsubscribed_at = None
                    record.save()
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
