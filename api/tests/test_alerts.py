import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.alerts import services
from apps.alerts.models import CONSENT_VERSION, DropAlertSubscriber
from apps.catalog.models import Accession, AccessionStatus, Drop, DropStatus

pytestmark = pytest.mark.django_db

SUBSCRIBE_URL = reverse("drop-alerts-subscribe")
UNSUBSCRIBE_URL = reverse("drop-alerts-unsubscribe")
ADMIN_URL = reverse("admin-drop-alerts")
PULSE_URL = reverse("catalog-pulse")


def _join(**body):
    return APIClient().post(SUBSCRIBE_URL, {"consent": True, **body}, format="json")


class TestSubscribe:
    def test_whatsapp_number_is_normalised_and_consent_recorded(self):
        before = timezone.now()

        response = _join(phone="0712 345 678", source="footer")

        assert response.status_code == 202
        subscriber = DropAlertSubscriber.objects.get()
        assert subscriber.phone == "+254712345678"
        assert subscriber.email == ""
        assert subscriber.consent_version == CONSENT_VERSION
        assert subscriber.consented_at >= before
        assert subscriber.source == "footer"

    def test_email_only_is_enough(self):
        assert _join(email="Wanjiku@Example.com").status_code == 202
        assert DropAlertSubscriber.objects.get().email == "wanjiku@example.com"

    def test_consent_is_required(self):
        response = APIClient().post(
            SUBSCRIBE_URL, {"phone": "0712345678", "consent": False}, format="json"
        )
        assert response.status_code == 400
        assert "consent" in response.json()["error"]["fields"]
        assert DropAlertSubscriber.objects.count() == 0

    def test_some_contact_is_required(self):
        response = _join()
        assert response.status_code == 400
        assert "phone" in response.json()["error"]["fields"]

    def test_bad_number_and_email_are_rejected(self):
        assert _join(phone="12345").status_code == 400
        assert _join(email="not-an-email").status_code == 400

    def test_signing_up_again_renews_rather_than_duplicating(self):
        _join(phone="0712345678")
        old = timezone.now() - timedelta(days=30)
        DropAlertSubscriber.objects.update(consented_at=old, consent_version="old")

        first = _join(phone="+254 712 345 678")
        second = _join(phone="0712345678", email="w@example.com")

        assert first.json() == second.json()
        subscriber = DropAlertSubscriber.objects.get()
        assert subscriber.consent_version == CONSENT_VERSION
        assert subscriber.consented_at > old
        assert subscriber.email == "w@example.com"

    def test_email_match_is_case_insensitive(self):
        _join(email="w@example.com")
        _join(email="W@EXAMPLE.COM", phone="0712345678")
        subscriber = DropAlertSubscriber.objects.get()
        assert subscriber.phone == "+254712345678"

    def test_rejoining_after_leaving_turns_alerts_back_on(self):
        _join(phone="0712345678")
        APIClient().post(UNSUBSCRIBE_URL, {"phone": "0712345678"}, format="json")
        assert DropAlertSubscriber.objects.get().unsubscribed_at is not None

        _join(phone="0712345678")

        assert DropAlertSubscriber.objects.get().unsubscribed_at is None

    def test_sign_ups_are_rate_limited_per_visitor(self, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"alerts": "2/hour"})
        codes = [_join(phone=f"071234567{n}").status_code for n in range(3)]
        assert codes == [202, 202, 429]


class TestUnsubscribe:
    def test_leaving_stops_alerts_without_deleting_the_consent_record(self):
        _join(phone="0712345678")

        response = APIClient().post(UNSUBSCRIBE_URL, {"phone": "0712 345 678"}, format="json")

        assert response.status_code == 202
        assert DropAlertSubscriber.objects.get().unsubscribed_at is not None

    def test_unknown_details_get_the_same_answer(self):
        _join(phone="0712345678")
        known = APIClient().post(UNSUBSCRIBE_URL, {"phone": "0712345678"}, format="json")
        unknown = APIClient().post(UNSUBSCRIBE_URL, {"email": "nobody@example.com"}, format="json")
        assert known.status_code == unknown.status_code == 202
        assert known.json() == unknown.json()

    def test_some_contact_is_required(self):
        assert APIClient().post(UNSUBSCRIBE_URL, {}, format="json").status_code == 400


class TestOwnerList:
    def test_owner_sees_current_subscribers(self, auth_client, owner):
        _join(phone="0712345678")
        _join(email="gone@example.com")
        APIClient().post(UNSUBSCRIBE_URL, {"email": "gone@example.com"}, format="json")

        current = auth_client(owner).get(ADMIN_URL).json()["results"]
        everyone = auth_client(owner).get(ADMIN_URL, {"include_unsubscribed": "true"}).json()

        assert [row["phone"] for row in current] == ["+254712345678"]
        assert len(everyone["results"]) == 2

    @pytest.mark.parametrize("role", ["editor", "packer"])
    def test_other_staff_may_not_read_the_list(self, auth_client, role, request):
        assert auth_client(request.getfixturevalue(role)).get(ADMIN_URL).status_code == 403

    def test_visitors_may_not_read_the_list(self):
        assert APIClient().get(ADMIN_URL).status_code == 401


@pytest.mark.concurrency
@pytest.mark.django_db(transaction=True)
def test_simultaneous_identical_sign_ups_make_one_record():
    barrier = threading.Barrier(8)
    errors: list[Exception] = []
    lock = threading.Lock()

    def join():
        try:
            barrier.wait()
            services.subscribe(phone="+254712345678")
        except Exception as exc:
            with lock:
                errors.append(exc)
        finally:
            connection.close()

    threads = [threading.Thread(target=join) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert DropAlertSubscriber.objects.count() == 1


class TestPulse:
    def _piece(self, number, status, **fields):
        return Accession.objects.create(
            number=number,
            title=f"Piece {number}",
            category="tee",
            price_kes=1500,
            status=status,
            published_at=timezone.now(),
            **fields,
        )

    def test_counts_the_rail_and_the_holds(self):
        self._piece(1, AccessionStatus.LIVE)
        self._piece(2, AccessionStatus.LIVE)
        self._piece(3, AccessionStatus.HELD)
        self._piece(4, AccessionStatus.CLAIMED)
        self._piece(5, AccessionStatus.DRAFT)
        self._piece(6, AccessionStatus.SCHEDULED, release_at=timezone.now() - timedelta(minutes=1))
        self._piece(7, AccessionStatus.SCHEDULED, release_at=timezone.now() + timedelta(days=1))

        body = APIClient().get(PULSE_URL).json()

        assert body["on_rail"] == 3
        assert body["on_hold"] == 1
        assert body["next_drop"] is None

    def test_next_drop_is_the_soonest_one_not_yet_open(self):
        now = timezone.now()
        Drop.objects.create(
            number=6,
            title="Opened",
            status=DropStatus.SCHEDULED,
            release_at=now - timedelta(hours=1),
        )
        Drop.objects.create(
            number=8, title="Later", status=DropStatus.SCHEDULED, release_at=now + timedelta(days=3)
        )
        Drop.objects.create(
            number=7,
            title="Sooner",
            status=DropStatus.SCHEDULED,
            release_at=now + timedelta(days=1),
        )
        Drop.objects.create(number=9, title="Draft", status=DropStatus.DRAFT)

        body = APIClient().get(PULSE_URL).json()

        assert body["next_drop"]["number"] == 7
        assert body["next_drop"]["title"] == "Sooner"
