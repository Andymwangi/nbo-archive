from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class AdminRole(models.TextChoices):
    OWNER = "owner", "Owner"
    EDITOR = "editor", "Editor"
    PACKER = "packer", "Packer"


class AdminUserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email: str, name: str, role: str, password: str | None, **extra):
        if not email:
            raise ValueError("Email is required.")
        user = self.model(email=self.normalize_email(email).lower(), name=name, role=role, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email, name="", role=AdminRole.EDITOR, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, name, role, password, **extra)

    def create_superuser(self, email, password=None, name="", **extra):
        extra["is_staff"] = True
        extra["is_superuser"] = True
        return self._create(email, name, AdminRole.OWNER, password, **extra)

    def get_by_natural_key(self, email):
        return self.get(email__iexact=email)


class AdminUser(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """Staff account. Customers never have accounts -- checkout is guest-only."""

    email = models.EmailField(max_length=254, unique=True)
    name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=16, blank=True)
    role = models.CharField(max_length=16, choices=AdminRole.choices, default=AdminRole.EDITOR)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = AdminUserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "admin_users"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class MagicLinkToken(TimeStampedModel):
    """Single-use sign-in token. Only the SHA-256 digest is stored; the raw token
    exists only in the email that was sent."""

    user = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name="magic_links")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "magic_link_tokens"
        indexes = [models.Index(fields=["user", "created_at"])]

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and self.expires_at > timezone.now()
