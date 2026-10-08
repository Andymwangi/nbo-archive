from django.db import models
from django.db.models.functions import Lower

from apps.common.models import TimeStampedModel


class Customer(TimeStampedModel):
    """A shopper who signed in. Checkout stays open to guests; signing in proves who is buying
    and keeps their orders and details together. There is no password: every sign-in is a
    one-time code sent to the customer's email (SMS later)."""

    email = models.EmailField(max_length=254)
    name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=16, blank=True)  # E.164 Kenyan mobile
    email_verified_at = models.DateTimeField(null=True, blank=True)
    last_signed_in_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "customers"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(Lower("email"), name="customer_email_ci_unique"),
        ]

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class CodeChannel(models.TextChoices):
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"


class SignInCode(TimeStampedModel):
    """A one-time sign-in code. Only a keyed hash is stored; the code itself exists only in the
    message that was sent."""

    channel = models.CharField(max_length=8, choices=CodeChannel.choices)
    destination = models.CharField(max_length=254)  # normalised email or E.164 phone
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "customer_sign_in_codes"
        indexes = [models.Index(fields=["destination", "created_at"])]


class CustomerSession(TimeStampedModel):
    """A signed-in browser. The web server keeps the raw token in an httpOnly cookie; only its
    hash is stored here, so a database leak does not hand out sessions."""

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="sessions")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "customer_sessions"
        indexes = [models.Index(fields=["customer", "revoked_at"])]
