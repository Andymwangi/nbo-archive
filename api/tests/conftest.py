import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import AdminRole, AdminUser
from apps.accounts.services import issue_tokens


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def _make_admin(email: str, role: str, **extra) -> AdminUser:
    return AdminUser.objects.create_user(email=email, name=email.split("@")[0], role=role, **extra)


@pytest.fixture
def owner(db) -> AdminUser:
    return _make_admin("wanjiru@nboarchive.test", AdminRole.OWNER)


@pytest.fixture
def editor(db) -> AdminUser:
    return _make_admin("otieno@nboarchive.test", AdminRole.EDITOR)


@pytest.fixture
def packer(db) -> AdminUser:
    return _make_admin("chebet@nboarchive.test", AdminRole.PACKER)


@pytest.fixture
def auth_client():
    """Return an APIClient authenticated as the given admin."""

    def _client(user: AdminUser) -> APIClient:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_tokens(user).access}")
        return client

    return _client
