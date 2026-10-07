from .base import *  # noqa: F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True
# Tests must not depend on a developer's .env; individual tests set these when they need them.
MEDIA_BASE_URL = ""
INTERNAL_API_TOKEN = ""
HOLDS_ENABLED = True
HOLD_DURATION_MINUTES = 15
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {
        **REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],  # noqa: F405
        "magic_link": "1000/min",
        "magic_link_verify": "1000/min",
        "hold": "1000/min",
    },
}
