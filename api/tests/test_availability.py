from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Accession, AccessionStatus

pytestmark = pytest.mark.django_db

LIST_URL = reverse("catalog-list")
FACETS_URL = reverse("catalog-facets")


@pytest.fixture
def shelf():
    now = timezone.now()

    def piece(number, status, **fields):
        return Accession.objects.create(
            number=number,
            title=f"Piece {number}",
            category="polo",
            price_kes=2000,
            status=status,
            published_at=now,
            **fields,
        )

    piece(1, AccessionStatus.LIVE)
    piece(2, AccessionStatus.LIVE)
    piece(3, AccessionStatus.SCHEDULED, release_at=now - timedelta(minutes=5))
    piece(4, AccessionStatus.HELD)
    piece(5, AccessionStatus.CLAIMED)
    piece(6, AccessionStatus.SCHEDULED, release_at=now + timedelta(days=1))
    piece(7, AccessionStatus.DRAFT)


def _numbers(**params) -> list[str]:
    body = APIClient().get(LIST_URL, params).json()
    return sorted(row["archive_no"] for row in body["results"])


def test_default_browse_is_the_rail_and_holds(shelf):
    assert _numbers() == ["NBO-0001", "NBO-0002", "NBO-0003", "NBO-0004"]


@pytest.mark.parametrize(
    ("availability", "expected"),
    [
        (["on_rail"], ["NBO-0001", "NBO-0002", "NBO-0003"]),
        (["on_hold"], ["NBO-0004"]),
        (["claimed"], ["NBO-0005"]),
        (["on_hold", "claimed"], ["NBO-0004", "NBO-0005"]),
    ],
)
def test_availability_narrows_to_where_a_piece_stands(shelf, availability, expected):
    assert _numbers(availability=availability) == expected


def test_include_claimed_still_works_for_old_links(shelf):
    assert "NBO-0005" in _numbers(include_claimed="true")


def test_unknown_availability_is_rejected(shelf):
    assert APIClient().get(LIST_URL, {"availability": "lost"}).status_code == 400


def test_facets_count_every_public_piece_by_availability(shelf):
    counts = {
        row["value"]: row["count"] for row in APIClient().get(FACETS_URL).json()["availability"]
    }
    assert counts == {"on_rail": 3, "on_hold": 1, "claimed": 1}
