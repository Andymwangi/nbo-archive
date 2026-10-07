from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.common.models import TimeStampedModel

# Bump when the consent wording on the sign-up form changes, so each record shows exactly what
# the person agreed to (Kenya Data Protection Act 2019: consent must be specific and provable).
CONSENT_VERSION = "2026-10-07"


class DropAlertSubscriber(TimeStampedModel):
    """Someone who asked to hear when a drop opens. Stores only what is needed to tell them."""

    phone = models.CharField(max_length=16, blank=True)  # E.164 Kenyan mobile, for WhatsApp
    email = models.EmailField(max_length=254, blank=True)
    consented_at = models.DateTimeField()
    consent_version = models.CharField(max_length=20)
    source = models.CharField(max_length=40, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "drop_alert_subscribers"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=~Q(phone="") | ~Q(email=""),
                name="drop_alert_has_contact",
            ),
            models.UniqueConstraint(
                fields=["phone"], condition=~Q(phone=""), name="drop_alert_phone_unique"
            ),
            models.UniqueConstraint(
                Lower("email"), condition=~Q(email=""), name="drop_alert_email_unique"
            ),
        ]

    def __str__(self) -> str:
        return self.phone or self.email
