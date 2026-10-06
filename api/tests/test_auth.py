import re
import threading
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail
from django.db import connection
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import AdminRole, MagicLinkToken
from apps.accounts.services import consume_magic_link
from apps.accounts.tokens import hash_token

pytestmark = pytest.mark.django_db

REQUEST_URL = reverse("auth-magic-link")
VERIFY_URL = reverse("auth-magic-link-verify")
REFRESH_URL = reverse("auth-refresh")
LOGOUT_URL = reverse("auth-logout")
ME_URL = reverse("auth-me")
USERS_URL = reverse("admin-users")


def _token_from_last_email() -> str:
    url = re.search(r"https?://\S+", mail.outbox[-1].body).group(0)
    return parse_qs(urlparse(url).query)["token"][0]


def _request_link(client, email, capture):
    with capture(execute=True):
        return client.post(REQUEST_URL, {"email": email}, format="json")


def _sign_in(client, user, capture) -> dict:
    _request_link(client, user.email, capture)
    response = client.post(VERIFY_URL, {"token": _token_from_last_email()}, format="json")
    assert response.status_code == 200
    return response.json()


class TestMagicLinkRequest:
    def test_active_admin_receives_single_use_link(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        response = _request_link(api_client, owner.email, django_capture_on_commit_callbacks)

        assert response.status_code == 202
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [owner.email]
        raw = _token_from_last_email()
        link = MagicLinkToken.objects.get(user=owner)
        assert link.token_hash == hash_token(raw)
        assert raw not in link.token_hash
        assert "/admin/verify?token=" in mail.outbox[0].body

    def test_unknown_email_gets_identical_response_and_no_email(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        known = _request_link(api_client, owner.email, django_capture_on_commit_callbacks)
        unknown = _request_link(
            api_client, "nobody@example.com", django_capture_on_commit_callbacks
        )

        assert unknown.status_code == known.status_code == 202
        assert unknown.json() == known.json()
        assert len(mail.outbox) == 1
        assert MagicLinkToken.objects.count() == 1

    def test_inactive_admin_gets_no_link(
        self, api_client, editor, django_capture_on_commit_callbacks
    ):
        editor.is_active = False
        editor.save()
        response = _request_link(api_client, editor.email, django_capture_on_commit_callbacks)

        assert response.status_code == 202
        assert mail.outbox == []

    def test_email_lookup_is_case_insensitive(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        _request_link(api_client, "  WanJiru@NBOARCHIVE.test ", django_capture_on_commit_callbacks)
        assert len(mail.outbox) == 1

    def test_per_address_cap_stops_inbox_flooding(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        for _ in range(5):
            _request_link(api_client, owner.email, django_capture_on_commit_callbacks)
        assert len(mail.outbox) == 3

    def test_malformed_email_returns_error_envelope(self, api_client):
        response = api_client.post(REQUEST_URL, {"email": "not-an-email"}, format="json")

        assert response.status_code == 400
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert "email" in error["fields"]

    def test_ip_throttle_returns_429(self, api_client, owner, monkeypatch):
        monkeypatch.setattr(
            ScopedRateThrottle,
            "THROTTLE_RATES",
            {"magic_link": "2/hour", "magic_link_verify": "2/hour"},
        )
        codes = [
            api_client.post(REQUEST_URL, {"email": owner.email}, format="json").status_code
            for _ in range(3)
        ]
        assert codes == [202, 202, 429]


class TestMagicLinkVerify:
    def test_valid_link_returns_tokens_and_user(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        body = _sign_in(api_client, owner, django_capture_on_commit_callbacks)

        assert body["access"] and body["refresh"]
        assert body["user"]["email"] == owner.email
        assert body["user"]["role"] == AdminRole.OWNER
        owner.refresh_from_db()
        assert owner.last_login is not None

    def test_link_works_only_once(self, api_client, owner, django_capture_on_commit_callbacks):
        _request_link(api_client, owner.email, django_capture_on_commit_callbacks)
        raw = _token_from_last_email()

        first = api_client.post(VERIFY_URL, {"token": raw}, format="json")
        second = api_client.post(VERIFY_URL, {"token": raw}, format="json")

        assert first.status_code == 200
        assert second.status_code == 401
        assert second.json()["error"]["code"] == "invalid_link"

    def test_expired_link_is_rejected(self, api_client, owner, django_capture_on_commit_callbacks):
        _request_link(api_client, owner.email, django_capture_on_commit_callbacks)
        MagicLinkToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

        response = api_client.post(VERIFY_URL, {"token": _token_from_last_email()}, format="json")
        assert response.status_code == 401

    def test_link_for_deactivated_admin_is_rejected(
        self, api_client, editor, django_capture_on_commit_callbacks
    ):
        _request_link(api_client, editor.email, django_capture_on_commit_callbacks)
        editor.is_active = False
        editor.save()

        response = api_client.post(VERIFY_URL, {"token": _token_from_last_email()}, format="json")
        assert response.status_code == 401

    def test_sign_in_retires_other_outstanding_links(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        _request_link(api_client, owner.email, django_capture_on_commit_callbacks)
        older = _token_from_last_email()
        _request_link(api_client, owner.email, django_capture_on_commit_callbacks)
        newer = _token_from_last_email()

        assert api_client.post(VERIFY_URL, {"token": newer}, format="json").status_code == 200
        assert api_client.post(VERIFY_URL, {"token": older}, format="json").status_code == 401

    def test_unknown_token_is_rejected(self, api_client, owner):
        response = api_client.post(VERIFY_URL, {"token": "x" * 43}, format="json")
        assert response.status_code == 401

    def test_malformed_token_is_a_validation_error(self, api_client):
        response = api_client.post(VERIFY_URL, {"token": "short"}, format="json")
        assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
@pytest.mark.concurrency
def test_concurrent_redemption_of_one_link_succeeds_exactly_once(owner):
    """Ten threads race to redeem the same link against real PostgreSQL row locks."""
    from apps.accounts.services import request_magic_link

    request_magic_link(owner.email, ip=None, user_agent="")
    raw = _token_from_last_email()

    barrier = threading.Barrier(10)
    results: list[str] = []
    lock = threading.Lock()

    def redeem():
        try:
            barrier.wait()
            consume_magic_link(raw)
            outcome = "ok"
        except Exception as exc:
            outcome = type(exc).__name__
        finally:
            connection.close()
        with lock:
            results.append(outcome)

    threads = [threading.Thread(target=redeem) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results.count("ok") == 1
    assert results.count("InvalidCredentialError") == 9


class TestSession:
    def test_me_requires_authentication(self, api_client):
        response = api_client.get(ME_URL)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "not_authenticated"

    def test_me_returns_current_admin(self, api_client, editor, django_capture_on_commit_callbacks):
        body = _sign_in(api_client, editor, django_capture_on_commit_callbacks)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")

        response = api_client.get(ME_URL)
        assert response.status_code == 200
        assert response.json()["email"] == editor.email

    def test_refresh_issues_access_and_keeps_refresh_stable(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        """Parallel requests that refresh with the same token must all succeed; rotation
        would log the admin out when two tabs or prefetches refresh at once."""
        body = _sign_in(api_client, owner, django_capture_on_commit_callbacks)

        first = api_client.post(REFRESH_URL, {"refresh": body["refresh"]}, format="json")
        second = api_client.post(REFRESH_URL, {"refresh": body["refresh"]}, format="json")

        assert first.status_code == second.status_code == 200
        assert set(first.json()) == {"access"}
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {second.json()['access']}")
        assert api_client.get(ME_URL).status_code == 200

    def test_logout_revokes_refresh_token(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        body = _sign_in(api_client, owner, django_capture_on_commit_callbacks)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")

        assert (
            api_client.post(LOGOUT_URL, {"refresh": body["refresh"]}, format="json").status_code
            == 200
        )
        assert (
            api_client.post(LOGOUT_URL, {"refresh": body["refresh"]}, format="json").status_code
            == 400
        )

        api_client.credentials()
        replay = api_client.post(REFRESH_URL, {"refresh": body["refresh"]}, format="json")
        assert replay.status_code == 401
        error = replay.json()["error"]
        assert error == {"code": "token_not_valid", "message": "Token is blacklisted"}

    def test_deactivated_admin_loses_access_and_refresh(
        self, api_client, editor, django_capture_on_commit_callbacks
    ):
        body = _sign_in(api_client, editor, django_capture_on_commit_callbacks)
        editor.is_active = False
        editor.save()

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
        assert api_client.get(ME_URL).status_code == 401
        api_client.credentials()
        replay = api_client.post(REFRESH_URL, {"refresh": body["refresh"]}, format="json")
        assert replay.status_code == 401
        error = replay.json()["error"]
        assert error["code"] == "no_active_account"

    def test_garbage_bearer_token_is_rejected(self, api_client):
        api_client.credentials(HTTP_AUTHORIZATION="Bearer not.a.jwt")
        response = api_client.get(ME_URL)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "token_not_valid"


class TestAdminUserManagement:
    def test_owner_lists_admins(self, auth_client, owner, editor):
        response = auth_client(owner).get(USERS_URL)
        assert response.status_code == 200
        emails = {row["email"] for row in response.json()["results"]}
        assert emails == {owner.email, editor.email}

    @pytest.mark.parametrize("role_fixture", ["editor", "packer"])
    def test_non_owners_are_forbidden(self, auth_client, role_fixture, request):
        user = request.getfixturevalue(role_fixture)
        client = auth_client(user)
        assert client.get(USERS_URL).status_code == 403
        assert client.post(USERS_URL, {}, format="json").status_code == 403

    def test_owner_adds_admin_who_receives_link(
        self, auth_client, owner, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            response = auth_client(owner).post(
                USERS_URL,
                {"email": "Akinyi@NBOarchive.test", "name": "Akinyi", "role": "packer"},
                format="json",
            )

        assert response.status_code == 201
        assert response.json()["email"] == "akinyi@nboarchive.test"
        assert response.json()["role"] == "packer"
        assert mail.outbox[-1].to == ["akinyi@nboarchive.test"]

    def test_duplicate_email_is_rejected_case_insensitively(self, auth_client, owner, editor):
        response = auth_client(owner).post(
            USERS_URL,
            {"email": editor.email.upper(), "name": "Dup", "role": "editor"},
            format="json",
        )
        assert response.status_code == 400
        assert "email" in response.json()["error"]["fields"]

    def test_invalid_role_is_rejected(self, auth_client, owner):
        response = auth_client(owner).post(
            USERS_URL,
            {"email": "x@nboarchive.test", "name": "X", "role": "superadmin"},
            format="json",
        )
        assert response.status_code == 400

    def test_cannot_demote_last_owner(self, auth_client, owner, editor):
        url = reverse("admin-user-detail", args=[owner.pk])
        response = auth_client(owner).patch(url, {"role": "editor"}, format="json")

        assert response.status_code == 400
        owner.refresh_from_db()
        assert owner.role == AdminRole.OWNER

    def test_owner_can_be_demoted_when_another_owner_exists(self, auth_client, owner, editor):
        editor.role = AdminRole.OWNER
        editor.save()
        url = reverse("admin-user-detail", args=[owner.pk])

        response = auth_client(editor).patch(url, {"role": "editor"}, format="json")
        assert response.status_code == 200
        assert response.json()["role"] == "editor"

    def test_owner_cannot_deactivate_self(self, auth_client, owner):
        url = reverse("admin-user-detail", args=[owner.pk])
        response = auth_client(owner).patch(url, {"is_active": False}, format="json")
        assert response.status_code == 400

    def test_owner_deactivates_editor(self, auth_client, owner, editor):
        url = reverse("admin-user-detail", args=[editor.pk])
        response = auth_client(owner).patch(url, {"is_active": False}, format="json")

        assert response.status_code == 200
        editor.refresh_from_db()
        assert editor.is_active is False

    def test_unknown_admin_returns_404_envelope(self, auth_client, owner):
        response = auth_client(owner).get(reverse("admin-user-detail", args=[99999]))
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


def test_health_reports_dependencies(api_client, db):
    response = api_client.get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"database": "ok", "cache": "ok"}


def test_unauthenticated_client_cannot_reach_owner_routes(db):
    assert APIClient().get(USERS_URL).status_code == 401


class TestAdminPhone:
    def test_phone_is_normalised_on_create(self, auth_client, owner):
        response = auth_client(owner).post(
            USERS_URL,
            {
                "email": "baraka@nboarchive.test",
                "name": "Baraka",
                "role": "editor",
                "phone": "0712 345 678",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["phone"] == "+254712345678"

    def test_invalid_phone_is_rejected_on_update(self, auth_client, owner, editor):
        url = reverse("admin-user-detail", args=[editor.pk])
        response = auth_client(owner).patch(url, {"phone": "12345"}, format="json")
        assert response.status_code == 400
        assert "phone" in response.json()["error"]["fields"]

    def test_phone_can_be_cleared(self, auth_client, owner, editor):
        url = reverse("admin-user-detail", args=[editor.pk])
        response = auth_client(owner).patch(url, {"phone": ""}, format="json")
        assert response.status_code == 200
        assert response.json()["phone"] == ""


class TestHousekeeping:
    def test_purge_removes_only_stale_links(self, owner):
        from apps.accounts.tasks import purge_stale_magic_links

        now = timezone.now()
        long_ago = now - timedelta(days=8)
        stale_expired = MagicLinkToken.objects.create(
            user=owner, token_hash="a" * 64, expires_at=long_ago
        )
        stale_used = MagicLinkToken.objects.create(
            user=owner, token_hash="b" * 64, expires_at=now + timedelta(minutes=5), used_at=long_ago
        )
        fresh = MagicLinkToken.objects.create(
            user=owner, token_hash="c" * 64, expires_at=now + timedelta(minutes=5)
        )
        recently_expired = MagicLinkToken.objects.create(
            user=owner, token_hash="d" * 64, expires_at=now - timedelta(days=1)
        )

        assert purge_stale_magic_links() == 2
        remaining = set(MagicLinkToken.objects.values_list("pk", flat=True))
        assert remaining == {fresh.pk, recently_expired.pk}
        assert stale_expired.pk not in remaining and stale_used.pk not in remaining

    def test_beat_schedule_points_at_real_tasks(self):
        from django.conf import settings

        from config.celery import app

        app.loader.import_default_modules()
        for entry in settings.CELERY_BEAT_SCHEDULE.values():
            assert entry["task"] in app.tasks

    def test_flush_expired_jwt_runs(self, owner):
        from apps.accounts.tasks import flush_expired_jwt

        flush_expired_jwt()


class TestForwardedClientIp:
    def _post(self, client, email, ip):
        return client.post(
            REQUEST_URL,
            {"email": email},
            format="json",
            REMOTE_ADDR="127.0.0.1",
            HTTP_X_FORWARDED_FOR=ip,
        )

    def test_throttle_counts_each_visitor_behind_the_web_server(
        self, api_client, owner, monkeypatch
    ):
        monkeypatch.setattr(
            ScopedRateThrottle,
            "THROTTLE_RATES",
            {"magic_link": "2/hour", "magic_link_verify": "2/hour"},
        )
        first = [self._post(api_client, owner.email, "198.51.100.7").status_code for _ in range(3)]
        other = self._post(api_client, owner.email, "198.51.100.8").status_code

        assert first == [202, 202, 429]
        assert other == 202

    def test_forwarded_address_is_recorded_on_the_link(
        self, api_client, owner, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            self._post(api_client, owner.email, "198.51.100.7")
        assert MagicLinkToken.objects.get(user=owner).requested_ip == "198.51.100.7"

    def test_loosely_formatted_phone_is_accepted(self, auth_client, owner):
        response = auth_client(owner).post(
            USERS_URL,
            {
                "email": "wambui@nboarchive.test",
                "name": "Wambui",
                "role": "packer",
                "phone": "+254 (712) 345-678",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["phone"] == "+254712345678"
