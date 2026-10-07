from datetime import timedelta
from pathlib import Path

import environ
from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BASE_DIR.parent

env = environ.Env()
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    env.read_env(str(_env_file))

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "apps.common",
    "apps.accounts",
    "apps.catalog",
    "apps.inventory",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.AdminUser"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL", default="/media/")
# Public origin that serves MEDIA_URL (e.g. https://api.example.com). Image URLs are built from it
# rather than from the request host, which is the API's internal address when the web server calls
# it. Empty falls back to the request host.
MEDIA_BASE_URL = env("MEDIA_BASE_URL", default="").rstrip("/")
MEDIA_ROOT = BASE_DIR / "media"

# Only local storage exists today. A Cloudinary or S3 backend needs its package and a branch here.
MEDIA_STORAGE = env("MEDIA_STORAGE", default="local") or "local"
if MEDIA_STORAGE != "local":
    raise ImproperlyConfigured(f"MEDIA_STORAGE={MEDIA_STORAGE!r} is not supported; use 'local'.")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# Direct peers allowed to vouch for the visitor's address via X-Forwarded-For (the web app's
# server). Loopback covers local development; add the compose or hosting network in deployment.
TRUSTED_PROXIES = env.list("TRUSTED_PROXIES", default=["127.0.0.1/32", "::1/128"])

# Shared with the web server. Requests carrying it in X-Internal-Token skip the anonymous rate
# limit, so cache refreshes of public pages (which have no visitor behind them) are not throttled
# as one client. Scoped limits such as magic-link requests still apply. Empty disables the bypass.
INTERNAL_API_TOKEN = env("INTERNAL_API_TOKEN", default="")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.ArchivePagination",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "apps.common.client_ip.ClientAnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/min",
        "user": "600/min",
        "magic_link": "5/hour",
        "magic_link_verify": "20/hour",
        "hold": "30/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=14)),
    # Refresh tokens live in an httpOnly cookie on the web app. Rotation would make concurrent
    # requests that refresh at the same moment race each other into a forced logout, so the
    # refresh token is stable for its lifetime and revoked explicitly on logout.
    "ROTATE_REFRESH_TOKENS": False,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "nboarchive API",
    "DESCRIPTION": "The Accession Room -- catalogue, holds, orders and payments for nboarchive.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "ENUM_NAME_OVERRIDES": {
        "AccessionStatusEnum": "apps.catalog.models.AccessionStatus",
        "PublicAccessionStatusEnum": ["live", "held", "claimed"],
        "DropStatusEnum": "apps.catalog.models.DropStatus",
    },
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL"),
    }
}

CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = None
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_TIME_LIMIT = 120
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "purge-stale-magic-links": {
        "task": "apps.accounts.tasks.purge_stale_magic_links",
        "schedule": crontab(hour=3, minute=10),
    },
    "flush-expired-jwt": {
        "task": "apps.accounts.tasks.flush_expired_jwt",
        "schedule": crontab(hour=3, minute=20),
    },
    "release-due-pieces": {
        "task": "apps.catalog.tasks.release_due_pieces",
        "schedule": crontab(),
    },
    "expire-holds": {
        "task": "apps.inventory.tasks.expire_holds",
        "schedule": crontab(),
    },
}

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = int(env("EMAIL_PORT", default="") or 587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = True
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

WEB_BASE_URL = env("WEB_BASE_URL").rstrip("/")
MAGIC_LINK_TTL_MINUTES = env.int("MAGIC_LINK_TTL_MINUTES", default=15)
HOLD_DURATION_MINUTES = env.int("HOLD_DURATION_MINUTES", default=15)
# Off until checkout and payment exist, so production pieces cannot be held with no way to buy.
HOLDS_ENABLED = env.bool("HOLDS_ENABLED", default=False)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
