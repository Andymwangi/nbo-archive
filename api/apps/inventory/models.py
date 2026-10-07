from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.catalog.models import Accession
from apps.common.models import TimeStampedModel


class HoldStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    CONVERTED = "converted", "Converted to an order"
    RELEASED = "released", "Released"
    EXPIRED = "expired", "Expired"


class Hold(TimeStampedModel):
    """A timed reservation of one piece by one visitor.

    The piece's own status moves to `held` in the same transaction that creates an active hold,
    and back to `live` when the hold ends, so the catalogue and the hold never disagree.
    """

    accession = models.ForeignKey(Accession, on_delete=models.PROTECT, related_name="holds")
    # SHA-256 of the visitor's random cookie value. The raw value never reaches the database.
    visitor_key = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=HoldStatus.choices, default=HoldStatus.ACTIVE)
    expires_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="released_holds",
    )

    class Meta:
        db_table = "holds"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["visitor_key", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]
        constraints = [
            # The database itself refuses a second active hold on a piece, whatever the code does.
            models.UniqueConstraint(
                fields=["accession"],
                condition=Q(status="active"),
                name="hold_one_active_per_piece",
            ),
            models.CheckConstraint(
                condition=Q(status="active", ended_at__isnull=True)
                | (~Q(status="active") & Q(ended_at__isnull=False)),
                name="hold_ended_at_matches_status",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.accession.archive_no} {self.status} until {self.expires_at:%H:%M}"
