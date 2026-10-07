import secrets
from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.catalog.models import Accession, AccessionStatus
from apps.inventory import services
from apps.inventory.models import Hold, HoldStatus

pytestmark = pytest.mark.django_db

HOLDS_URL = reverse("holds")


def _token() -> str:
    return secrets.token_urlsafe(32)


def _piece(number: int, status=AccessionStatus.LIVE, **fields) -> Accession:
    now = timezone.now()
    defaults = {
        "title": f"Piece {number}",
        "category": "tee",
        "price_kes": 2800,
        "status": status,
        "published_at": now if status != AccessionStatus.DRAFT else None,
    }
    return Accession.objects.create(number=number, **{**defaults, **fields})


def _visitor(token: str | None = None) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_X_VISITOR_TOKEN=token or _token())
    return client


def _place(client: APIClient, archive_no: str):
    return client.post(HOLDS_URL, {"archive_no": archive_no}, format="json")


def _detail(archive_no: str):
    return APIClient().get(reverse("catalog-detail", kwargs={"archive_no": archive_no}))


def _status(accession: Accession) -> str:
    accession.refresh_from_db()
    return accession.status


class TestPlaceHold:
    def test_live_piece_is_held_for_fifteen_minutes(self):
        piece = _piece(142)
        before = timezone.now()

        response = _place(_visitor(), "NBO-0142")

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "active"
        assert body["piece"]["archive_no"] == "NBO-0142"
        expires = Hold.objects.get().expires_at
        assert before + timedelta(minutes=15) <= expires <= timezone.now() + timedelta(minutes=15)
        assert _status(piece) == AccessionStatus.HELD

    def test_public_record_shows_when_a_held_piece_comes_back(self):
        _piece(7)
        _place(_visitor(), "7")

        body = _detail("7").json()

        assert body["status"] == "held"
        assert body["hold"]["expires_at"] is not None

    def test_public_record_has_no_hold_while_on_sale(self):
        _piece(7)
        assert _detail("7").json()["hold"] is None

    def test_same_visitor_asking_again_gets_the_same_hold(self):
        _piece(3)
        client = _visitor()

        first = _place(client, "3")
        again = _place(client, "NBO-0003")

        assert first.status_code == 201
        assert again.status_code == 200
        assert again.json()["id"] == first.json()["id"]
        assert Hold.objects.count() == 1

    def test_someone_else_cannot_hold_a_held_piece(self):
        _piece(3)
        _place(_visitor(), "3")

        response = _place(_visitor(), "3")

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "piece_held"

    @pytest.mark.parametrize("status", [AccessionStatus.DRAFT, AccessionStatus.WITHDRAWN])
    def test_unpublished_pieces_do_not_exist_for_visitors(self, status):
        _piece(9, status=status)
        assert _place(_visitor(), "9").status_code == 404

    def test_future_scheduled_piece_is_not_public(self):
        _piece(
            9,
            status=AccessionStatus.SCHEDULED,
            release_at=timezone.now() + timedelta(hours=1),
        )
        assert _place(_visitor(), "9").status_code == 404

    def test_due_scheduled_piece_can_be_held_before_the_release_task_runs(self):
        piece = _piece(
            9,
            status=AccessionStatus.SCHEDULED,
            release_at=timezone.now() - timedelta(minutes=1),
        )

        assert _place(_visitor(), "9").status_code == 201
        piece.refresh_from_db()
        assert piece.status == AccessionStatus.HELD
        assert piece.release_at is None

    def test_claimed_piece_is_not_for_sale(self):
        _piece(9, status=AccessionStatus.CLAIMED)
        response = _place(_visitor(), "9")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "not_for_sale"

    def test_unknown_and_malformed_numbers_are_not_found(self):
        assert _place(_visitor(), "NBO-9999").status_code == 404
        assert _place(_visitor(), "not-a-number").status_code == 404

    def test_a_visitor_holds_at_most_three_pieces(self):
        for number in range(1, 5):
            _piece(number)
        client = _visitor()

        codes = [_place(client, str(n)).status_code for n in range(1, 5)]

        assert codes == [201, 201, 201, 409]
        assert _status(Accession.objects.get(number=4)) == AccessionStatus.LIVE

    def test_lapsed_holds_do_not_count_towards_the_cap(self):
        for number in range(1, 5):
            _piece(number)
        client = _visitor()
        for n in range(1, 4):
            _place(client, str(n))
        Hold.objects.filter(accession__number=1).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        assert _place(client, "4").status_code == 201

    def test_a_lapsed_hold_never_blocks_the_next_buyer(self):
        piece = _piece(5)
        _place(_visitor(), "5")
        Hold.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

        response = _place(_visitor(), "5")

        assert response.status_code == 201
        statuses = sorted(Hold.objects.values_list("status", flat=True))
        assert statuses == [HoldStatus.ACTIVE, HoldStatus.EXPIRED]
        assert _status(piece) == AccessionStatus.HELD

    @pytest.mark.parametrize("token", [None, "", "short", "has spaces and is long enough!!!!!!!"])
    def test_visitor_token_is_required_and_well_formed(self, token):
        _piece(1)
        client = APIClient()
        if token is not None:
            client.credentials(HTTP_X_VISITOR_TOKEN=token)

        response = _place(client, "1")

        assert response.status_code == 400
        assert "token" in response.json()["error"]["fields"]

    def test_hold_creation_is_rate_limited_per_visitor_address(self, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"hold": "2/min"})
        for number in range(1, 4):
            _piece(number)
        client = _visitor()

        codes = [_place(client, str(n)).status_code for n in range(1, 4)]

        assert codes == [201, 201, 429]

    def test_reading_holds_is_not_counted_against_the_hold_rate(self, monkeypatch):
        monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"hold": "1/min"})
        client = _visitor()
        assert [client.get(HOLDS_URL).status_code for _ in range(3)] == [200, 200, 200]


class TestHeldPieceIsFrozen:
    def test_catalogue_edits_wait_until_the_hold_ends(self, auth_client, editor):
        piece = _piece(11)
        client = _visitor()
        hold_id = _place(client, "11").json()["id"]
        desk = auth_client(editor)
        withdraw = reverse("admin-accession-withdraw", kwargs={"pk": piece.pk})

        assert desk.post(withdraw).status_code == 409
        assert _status(piece) == AccessionStatus.HELD

        client.delete(reverse("hold-detail", kwargs={"pk": hold_id}))
        assert desk.post(withdraw).status_code == 200
        assert _status(piece) == AccessionStatus.WITHDRAWN


class TestVisitorHolds:
    def test_lists_only_this_visitors_current_holds_soonest_first(self):
        for number in range(1, 4):
            _piece(number)
        mine, theirs = _token(), _token()
        _place(_visitor(mine), "1")
        _place(_visitor(mine), "2")
        _place(_visitor(theirs), "3")
        Hold.objects.filter(accession__number=1).update(
            expires_at=timezone.now() + timedelta(minutes=1)
        )
        Hold.objects.filter(accession__number=2).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        body = _visitor(mine).get(HOLDS_URL).json()

        assert [hold["piece"]["archive_no"] for hold in body] == ["NBO-0001"]

    def test_new_visitor_has_no_holds(self):
        response = _visitor().get(HOLDS_URL)
        assert response.status_code == 200
        assert response.json() == []


class TestReleaseHold:
    def test_visitor_lets_go_and_the_piece_is_back_on_sale(self):
        piece = _piece(8)
        client = _visitor()
        hold_id = _place(client, "8").json()["id"]
        url = reverse("hold-detail", kwargs={"pk": hold_id})

        assert client.delete(url).status_code == 204
        assert _status(piece) == AccessionStatus.LIVE
        hold = Hold.objects.get()
        assert hold.status == HoldStatus.RELEASED
        assert hold.ended_at is not None
        assert client.delete(url).status_code == 204

    def test_nobody_else_can_release_your_hold(self):
        piece = _piece(8)
        hold_id = _place(_visitor(), "8").json()["id"]

        response = _visitor().delete(reverse("hold-detail", kwargs={"pk": hold_id}))

        assert response.status_code == 404
        assert _status(piece) == AccessionStatus.HELD

    def test_released_piece_can_be_held_again(self):
        _piece(8)
        client = _visitor()
        hold_id = _place(client, "8").json()["id"]
        client.delete(reverse("hold-detail", kwargs={"pk": hold_id}))

        assert _place(_visitor(), "8").status_code == 201


class TestExpiry:
    def test_expire_due_returns_lapsed_pieces_to_sale_and_is_repeatable(self):
        lapsed, fresh = _piece(1), _piece(2)
        _place(_visitor(), "1")
        _place(_visitor(), "2")
        Hold.objects.filter(accession=lapsed).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        assert services.expire_due() == 1
        assert services.expire_due() == 0
        assert _status(lapsed) == AccessionStatus.LIVE
        assert _status(fresh) == AccessionStatus.HELD
        assert Hold.objects.get(accession=lapsed).status == HoldStatus.EXPIRED

    def test_expiry_task_runs_the_service(self):
        from apps.inventory.tasks import expire_holds

        piece = _piece(1)
        _place(_visitor(), "1")
        Hold.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

        expire_holds()

        assert _status(piece) == AccessionStatus.LIVE

    def test_expiry_leaves_a_converted_hold_alone(self):
        piece = _piece(1)
        _place(_visitor(), "1")
        now = timezone.now()
        Hold.objects.update(
            status=HoldStatus.CONVERTED, ended_at=now, expires_at=now - timedelta(seconds=1)
        )

        assert services.expire_due() == 0
        assert _status(piece) == AccessionStatus.HELD


class TestStaffRelease:
    def _url(self, piece: Accession) -> str:
        return reverse("admin-accession-release-hold", kwargs={"pk": piece.pk})

    def test_editor_clears_a_stuck_hold(self, auth_client, editor):
        piece = _piece(4)
        _place(_visitor(), "4")
        desk = auth_client(editor)
        detail = desk.get(reverse("admin-accession-detail", kwargs={"pk": piece.pk})).json()
        assert detail["active_hold"]["expires_at"] is not None

        response = desk.post(self._url(piece))

        assert response.status_code == 200
        assert response.json()["status"] == "live"
        assert response.json()["active_hold"] is None
        hold = Hold.objects.get()
        assert hold.status == HoldStatus.RELEASED
        assert hold.ended_by == editor

    def test_packer_may_not_release(self, auth_client, packer):
        piece = _piece(4)
        _place(_visitor(), "4")
        assert auth_client(packer).post(self._url(piece)).status_code == 403

    def test_nothing_to_release(self, auth_client, owner):
        piece = _piece(4)
        response = auth_client(owner).post(self._url(piece))
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "no_hold"


class TestHoldsSwitch:
    def test_everything_is_closed_while_holds_are_off(self, settings):
        settings.HOLDS_ENABLED = False
        _piece(1)
        client = _visitor()

        for response in (
            _place(client, "1"),
            client.get(HOLDS_URL),
            client.delete(reverse("hold-detail", kwargs={"pk": 1})),
        ):
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "holds_closed"
        assert Hold.objects.count() == 0


class TestDatabaseGuard:
    def test_database_refuses_a_second_active_hold_on_one_piece(self):
        piece = _piece(1)
        expires = timezone.now() + timedelta(minutes=15)
        Hold.objects.create(accession=piece, visitor_key="a" * 64, expires_at=expires)

        with pytest.raises(IntegrityError), transaction.atomic():
            Hold.objects.create(accession=piece, visitor_key="b" * 64, expires_at=expires)

    def test_database_refuses_an_ended_hold_without_an_end_time(self):
        piece = _piece(1)
        with pytest.raises(IntegrityError), transaction.atomic():
            Hold.objects.create(
                accession=piece,
                visitor_key="a" * 64,
                status=HoldStatus.RELEASED,
                expires_at=timezone.now(),
            )
