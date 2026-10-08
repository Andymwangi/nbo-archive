import re
import threading
from datetime import timedelta

import pytest
from django.core import mail
from django.db import connection
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.common.exceptions import InvalidCredentialError
from apps.customers import services
from apps.customers.models import Customer, CustomerSession, SignInCode
from apps.customers.tasks import purge_customer_auth

pytestmark = pytest.mark.django_db

REQUEST_URL = reverse("customer-sign-in")
VERIFY_URL = reverse("customer-sign-in-verify")
ME_URL = reverse("customer-me")
SIGN_OUT_URL = reverse("customer-sign-out")


def _code_from_last_email() -> str:
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].subject).group(1)


def _request(client, email, capture):
    with capture(execute=True):
        return client.post(REQUEST_URL, {"email": email}, format="json")


def _verify(client, email, code):
    return client.post(VERIFY_URL, {"email": email, "code": code}, format="json")


def _sign_in(client, email, capture) -> str:
    _request(client, email, capture)
    response = _verify(client, email, _code_from_last_email())
    assert response.status_code == 200
    return response.json()["token"]


def _as(token: str) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_X_CUSTOMER_SESSION=token)
    return client


class TestRequestCode:
    def test_any_address_gets_a_six_digit_code_stored_only_as_a_hash(
        self, api_client, django_capture_on_commit_callbacks
    ):
        response = _request(api_client, "Wanjiku@Example.com", django_capture_on_commit_callbacks)

        assert response.status_code == 202
        assert mail.outbox[-1].to == ["wanjiku@example.com"]
        code = _code_from_last_email()
        row = SignInCode.objects.get()
        assert row.destination == "wanjiku@example.com"
        assert code not in row.code_hash
        assert Customer.objects.count() == 0

    def test_known_and_unknown_addresses_get_the_same_answer(
        self, api_client, django_capture_on_commit_callbacks
    ):
        _sign_in(api_client, "known@example.com", django_capture_on_commit_callbacks)
        known = _request(api_client, "known@example.com", django_capture_on_commit_callbacks)
        unknown = _request(api_client, "new@example.com", django_capture_on_commit_callbacks)
        assert known.status_code == unknown.status_code == 202
        assert known.json() == unknown.json()

    def test_an_address_gets_at_most_three_codes_per_window(
        self, api_client, django_capture_on_commit_callbacks
    ):
        for _ in range(5):
            _request(api_client, "w@example.com", django_capture_on_commit_callbacks)
        assert len(mail.outbox) == 3

    def test_requests_are_rate_limited_per_visitor(self, api_client, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"customer_code": "2/hour"})
        codes = [
            api_client.post(REQUEST_URL, {"email": f"{n}@example.com"}, format="json").status_code
            for n in range(3)
        ]
        assert codes == [202, 202, 429]


class TestVerifyCode:
    def test_right_code_signs_in_and_creates_the_customer(
        self, api_client, django_capture_on_commit_callbacks
    ):
        _request(api_client, "w@example.com", django_capture_on_commit_callbacks)

        response = _verify(api_client, "W@EXAMPLE.COM", _code_from_last_email())

        assert response.status_code == 200
        body = response.json()
        assert body["customer"]["email"] == "w@example.com"
        assert body["customer"]["email_verified_at"] is not None
        assert len(body["token"]) >= 40
        assert Customer.objects.count() == 1
        assert body["token"] not in CustomerSession.objects.get().token_hash

    def test_signing_in_again_reuses_the_customer(
        self, api_client, django_capture_on_commit_callbacks
    ):
        _sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks)
        _sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks)
        assert Customer.objects.count() == 1
        assert CustomerSession.objects.count() == 2

    def test_a_code_works_once(self, api_client, django_capture_on_commit_callbacks):
        _request(api_client, "w@example.com", django_capture_on_commit_callbacks)
        code = _code_from_last_email()
        assert _verify(api_client, "w@example.com", code).status_code == 200
        response = _verify(api_client, "w@example.com", code)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_code"

    def test_a_new_code_retires_the_previous_one(
        self, api_client, django_capture_on_commit_callbacks
    ):
        _request(api_client, "w@example.com", django_capture_on_commit_callbacks)
        older = _code_from_last_email()
        _request(api_client, "w@example.com", django_capture_on_commit_callbacks)
        newer = _code_from_last_email()

        if older != newer:
            assert _verify(api_client, "w@example.com", older).status_code == 401
        assert _verify(api_client, "w@example.com", newer).status_code == 200

    def test_expired_code_is_refused(self, api_client, django_capture_on_commit_callbacks):
        _request(api_client, "w@example.com", django_capture_on_commit_callbacks)
        SignInCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        assert _verify(api_client, "w@example.com", _code_from_last_email()).status_code == 401

    def test_wrong_guesses_are_counted_and_kill_the_code_after_five(
        self, api_client, django_capture_on_commit_callbacks
    ):
        _request(api_client, "w@example.com", django_capture_on_commit_callbacks)
        code = _code_from_last_email()
        wrong = "000000" if code != "000000" else "111111"

        for _ in range(5):
            assert _verify(api_client, "w@example.com", wrong).status_code == 401
        assert SignInCode.objects.get().attempts == 5
        assert _verify(api_client, "w@example.com", code).status_code == 401

    def test_malformed_code_is_a_validation_error(self, api_client):
        response = _verify(api_client, "w@example.com", "12ab")
        assert response.status_code == 400
        assert "code" in response.json()["error"]["fields"]


class TestSession:
    def test_profile_reads_and_updates(self, api_client, django_capture_on_commit_callbacks):
        client = _as(_sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks))

        assert client.get(ME_URL).json()["email"] == "w@example.com"
        response = client.patch(ME_URL, {"name": "Wanjiku", "phone": "0712 345 678"}, format="json")

        assert response.status_code == 200
        assert response.json()["name"] == "Wanjiku"
        assert response.json()["phone"] == "+254712345678"

    def test_bad_phone_is_refused(self, api_client, django_capture_on_commit_callbacks):
        client = _as(_sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks))
        response = client.patch(ME_URL, {"phone": "12345"}, format="json")
        assert response.status_code == 400
        assert "phone" in response.json()["error"]["fields"]

    def test_no_or_unknown_session_is_not_signed_in(self):
        for client in (APIClient(), _as("x" * 43)):
            response = client.get(ME_URL)
            assert response.status_code == 401
            assert response.json()["error"]["code"] == "not_signed_in"

    def test_sign_out_ends_the_session(self, api_client, django_capture_on_commit_callbacks):
        token = _sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks)
        client = _as(token)

        assert client.post(SIGN_OUT_URL).status_code == 204
        assert client.get(ME_URL).status_code == 401
        assert client.post(SIGN_OUT_URL).status_code == 204

    def test_expired_session_is_not_signed_in(self, api_client, django_capture_on_commit_callbacks):
        client = _as(_sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks))
        CustomerSession.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        assert client.get(ME_URL).status_code == 401


def test_purge_removes_old_codes_and_long_ended_sessions(
    api_client, django_capture_on_commit_callbacks
):
    token = _sign_in(api_client, "w@example.com", django_capture_on_commit_callbacks)
    old = timezone.now() - timedelta(days=40)
    SignInCode.objects.update(created_at=old)
    CustomerSession.objects.update(revoked_at=old)
    _sign_in(api_client, "fresh@example.com", django_capture_on_commit_callbacks)

    codes, sessions = purge_customer_auth()

    assert codes == 1
    assert sessions == 1
    assert services.authenticate(token) is None
    assert SignInCode.objects.count() == 1


@pytest.mark.concurrency
@pytest.mark.django_db(transaction=True)
def test_ten_simultaneous_uses_of_one_code_sign_in_once():
    services.request_code(email="race@example.com", ip=None)
    code = _code_from_last_email()
    barrier = threading.Barrier(10)
    outcomes: list[str] = []
    lock = threading.Lock()

    def redeem():
        try:
            barrier.wait()
            services.verify_code(email="race@example.com", code=code)
            outcome = "ok"
        except InvalidCredentialError:
            outcome = "refused"
        except Exception as exc:
            outcome = type(exc).__name__
        finally:
            connection.close()
        with lock:
            outcomes.append(outcome)

    threads = [threading.Thread(target=redeem) for _ in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(outcomes) == ["ok"] + ["refused"] * 9
    assert CustomerSession.objects.count() == 1
    assert Customer.objects.count() == 1
