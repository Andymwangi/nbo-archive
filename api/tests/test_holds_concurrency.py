"""Races against real PostgreSQL row and advisory locks. No mocks: each thread has its own
database connection, and a barrier releases them at the same instant."""

import secrets
import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from apps.catalog.models import Accession, AccessionStatus
from apps.common.exceptions import ConflictError
from apps.inventory import services
from apps.inventory.models import Hold, HoldStatus

pytestmark = [pytest.mark.concurrency, pytest.mark.django_db(transaction=True)]


def _piece(number: int) -> Accession:
    return Accession.objects.create(
        number=number,
        title=f"Piece {number}",
        category="jacket",
        price_kes=4500,
        status=AccessionStatus.LIVE,
        published_at=timezone.now(),
    )


def _race(jobs) -> tuple[list, list[Exception]]:
    barrier = threading.Barrier(len(jobs))
    results: list = []
    errors: list[Exception] = []
    lock = threading.Lock()

    def run(job):
        try:
            barrier.wait()
            outcome = job()
            with lock:
                results.append(outcome)
        except Exception as exc:
            with lock:
                errors.append(exc)
        finally:
            connection.close()

    threads = [threading.Thread(target=run, args=(job,)) for job in jobs]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results, errors


def _codes(errors: list[Exception]) -> list[str]:
    return sorted(str(error.get_codes()) for error in errors)


def test_fifty_visitors_racing_for_one_piece_produce_exactly_one_hold():
    piece = _piece(142)
    tokens = [secrets.token_urlsafe(32) for _ in range(50)]

    results, errors = _race(
        [lambda token=token: services.place_hold(number=142, token=token) for token in tokens]
    )

    assert len(results) == 1
    assert all(isinstance(error, ConflictError) for error in errors)
    assert _codes(errors) == ["piece_held"] * 49
    assert Hold.objects.filter(status=HoldStatus.ACTIVE).count() == 1
    piece.refresh_from_db()
    assert piece.status == AccessionStatus.HELD


def test_one_visitor_racing_for_six_pieces_gets_no_more_than_three():
    for number in range(1, 7):
        _piece(number)
    token = secrets.token_urlsafe(32)

    results, errors = _race(
        [
            lambda number=number: services.place_hold(number=number, token=token)
            for number in range(1, 7)
        ]
    )

    assert len(results) == 3
    assert _codes(errors) == ["hold_limit"] * 3
    assert Hold.objects.filter(status=HoldStatus.ACTIVE).count() == 3
    assert Accession.objects.filter(status=AccessionStatus.HELD).count() == 3


def test_expiry_racing_new_buyers_leaves_one_consistent_hold():
    """A lapsed hold, the expiry task and twenty new buyers all at once: exactly one new hold,
    the old one expired, and the piece held."""
    piece = _piece(9)
    services.place_hold(number=9, token=secrets.token_urlsafe(32))
    Hold.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    buyers = [secrets.token_urlsafe(32) for _ in range(20)]
    jobs = [lambda token=token: services.place_hold(number=9, token=token) for token in buyers]
    jobs += [services.expire_due for _ in range(5)]

    results, errors = _race(jobs)

    new_holds = [result for result in results if isinstance(result, tuple)]
    assert len(new_holds) == 1
    assert _codes(errors) == ["piece_held"] * 19
    assert Hold.objects.filter(status=HoldStatus.ACTIVE).count() == 1
    assert Hold.objects.filter(status=HoldStatus.EXPIRED).count() == 1
    piece.refresh_from_db()
    assert piece.status == AccessionStatus.HELD


def test_release_racing_expiry_ends_the_hold_once():
    piece = _piece(5)
    token = secrets.token_urlsafe(32)
    hold, _ = services.place_hold(number=5, token=token)
    Hold.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

    jobs = [lambda: services.release_hold(hold_id=hold.pk, token=token) for _ in range(5)]
    jobs += [services.expire_due for _ in range(5)]
    _, errors = _race(jobs)

    assert errors == []
    hold.refresh_from_db()
    assert hold.status in (HoldStatus.RELEASED, HoldStatus.EXPIRED)
    piece.refresh_from_db()
    assert piece.status == AccessionStatus.LIVE


def test_hold_racing_the_release_task_on_a_due_scheduled_piece():
    """The release task flips due pieces with an unlocked UPDATE. Postgres re-checks its
    WHERE clause after waiting on the hold's row lock, so it must never overwrite `held`."""
    from apps.catalog.services import release_due

    piece = Accession.objects.create(
        number=77,
        title="Due piece",
        category="hoodie",
        price_kes=3900,
        status=AccessionStatus.SCHEDULED,
        release_at=timezone.now() - timedelta(minutes=1),
        published_at=timezone.now() - timedelta(minutes=1),
    )
    buyers = [secrets.token_urlsafe(32) for _ in range(10)]
    jobs = [lambda token=token: services.place_hold(number=77, token=token) for token in buyers]
    jobs += [release_due for _ in range(5)]

    results, errors = _race(jobs)

    assert len([result for result in results if isinstance(result[0], Hold)]) == 1
    assert _codes(errors) == ["piece_held"] * 9
    piece.refresh_from_db()
    assert piece.status == AccessionStatus.HELD
    assert piece.release_at is None
    assert Hold.objects.filter(accession=piece, status=HoldStatus.ACTIVE).count() == 1


def test_hold_racing_a_withdraw_never_leaves_a_withdrawn_piece_held():
    from apps.catalog.services import withdraw_accession

    for _ in range(5):
        Hold.objects.all().delete()
        Accession.objects.all().delete()
        piece = _piece(88)
        jobs = [lambda: services.place_hold(number=88, token=secrets.token_urlsafe(32))]
        jobs += [lambda: withdraw_accession(Accession.objects.get(number=88))]

        _, errors = _race(jobs)

        piece.refresh_from_db()
        active = Hold.objects.filter(accession=piece, status=HoldStatus.ACTIVE).count()
        assert len(errors) == 1
        if piece.status == AccessionStatus.HELD:
            assert active == 1
        else:
            assert piece.status == AccessionStatus.WITHDRAWN
            assert active == 0
