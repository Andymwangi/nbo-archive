"""Holds: the one place a piece moves between `live` and `held`.

Locking order, everywhere: the visitor's advisory lock (placing only), then the piece row, then
its hold rows. Release and expiry never take the visitor lock, so no two paths can wait on each
other in opposite orders.
"""

import hashlib
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework import exceptions

from apps.catalog.models import Accession, AccessionStatus
from apps.common.exceptions import ConflictError
from apps.inventory.models import Hold, HoldStatus

MAX_ACTIVE_HOLDS = 3


class HoldsClosed(exceptions.APIException):
    status_code = 404
    default_detail = "Holds are not open yet."
    default_code = "holds_closed"


def visitor_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hold_duration() -> timedelta:
    return timedelta(minutes=settings.HOLD_DURATION_MINUTES)


def ensure_open() -> None:
    if not settings.HOLDS_ENABLED:
        raise HoldsClosed()


def _is_holdable(accession: Accession, now) -> bool:
    if accession.status == AccessionStatus.LIVE:
        return True
    # A scheduled piece is on sale from its release time, before the release task flips it.
    return (
        accession.status == AccessionStatus.SCHEDULED
        and accession.release_at is not None
        and accession.release_at <= now
    )


def _is_public(accession: Accession, now) -> bool:
    return accession.status in (
        AccessionStatus.LIVE,
        AccessionStatus.HELD,
        AccessionStatus.CLAIMED,
    ) or _is_holdable(accession, now)


def _lock_visitor(key: str) -> None:
    """Serialise one visitor's hold placements so the per-visitor cap cannot be raced past.
    Released automatically when the transaction ends."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", [key])


def _end(hold: Hold, status: str, now, actor=None) -> None:
    hold.status = status
    hold.ended_at = now
    hold.ended_by = actor
    hold.save(update_fields=["status", "ended_at", "ended_by", "updated_at"])


def _return_to_sale(accession: Accession) -> None:
    accession.status = AccessionStatus.LIVE
    accession.save(update_fields=["status", "updated_at"])


def _end_active_hold(accession: Accession, status: str, now, actor=None) -> Hold | None:
    """End the piece's active hold and put the piece back on sale. The piece must already be
    locked by the caller. Returns the hold that ended, if there was one. A hold whose time had
    already run out is recorded as expired, whoever ends it."""
    hold = (
        Hold.objects.select_for_update()
        .filter(accession=accession, status=HoldStatus.ACTIVE)
        .first()
    )
    if hold is None:
        return None
    _end(hold, HoldStatus.EXPIRED if hold.expires_at <= now else status, now, actor)
    if accession.status == AccessionStatus.HELD:
        _return_to_sale(accession)
    return hold


def place_hold(*, number: int, token: str, now=None) -> tuple[Hold, bool]:
    """Reserve a piece for the visitor. Returns (hold, created); asking again for a piece the
    visitor already holds returns the existing hold rather than an error."""
    ensure_open()
    key = visitor_key(token)
    with transaction.atomic():
        _lock_visitor(key)
        now = now or timezone.now()
        accession = Accession.objects.select_for_update().filter(number=number).first()
        if accession is None or not _is_public(accession, now):
            raise exceptions.NotFound()

        active = (
            Hold.objects.select_for_update()
            .filter(accession=accession, status=HoldStatus.ACTIVE)
            .first()
        )
        if active is not None and active.expires_at <= now:
            # The expiry task has not reached it yet; a lapsed hold must never block a buyer.
            _end_active_hold(accession, HoldStatus.EXPIRED, now)
            active = None
        if active is not None:
            if active.visitor_key == key:
                return active, False
            raise ConflictError(
                f"{accession.archive_no} is on hold for someone else.", code="piece_held"
            )
        if not _is_holdable(accession, now):
            raise ConflictError(f"{accession.archive_no} is not for sale.", code="not_for_sale")

        held_now = Hold.objects.filter(
            visitor_key=key, status=HoldStatus.ACTIVE, expires_at__gt=now
        ).count()
        if held_now >= MAX_ACTIVE_HOLDS:
            raise ConflictError(
                f"You can hold up to {MAX_ACTIVE_HOLDS} pieces at once.", code="hold_limit"
            )

        hold = Hold.objects.create(
            accession=accession,
            visitor_key=key,
            expires_at=now + hold_duration(),
        )
        accession.status = AccessionStatus.HELD
        # A due scheduled piece is released by being held, exactly as the release task would.
        accession.release_at = None
        accession.save(update_fields=["status", "release_at", "updated_at"])
    return hold, True


def release_hold(*, hold_id: int, token: str, now=None) -> None:
    """The visitor lets go of a piece before the time runs out."""
    key = visitor_key(token)
    hold = Hold.objects.filter(pk=hold_id, visitor_key=key).first()
    if hold is None:
        raise exceptions.NotFound()
    with transaction.atomic():
        accession = Accession.objects.select_for_update().get(pk=hold.accession_id)
        hold = Hold.objects.select_for_update().get(pk=hold.pk)
        if hold.status != HoldStatus.ACTIVE:
            # Already over (expired, released, or became an order): nothing left to release.
            return
        now = now or timezone.now()
        _end(hold, HoldStatus.RELEASED, now)
        if accession.status == AccessionStatus.HELD:
            _return_to_sale(accession)


def staff_release(*, accession: Accession, actor, now=None) -> Hold | None:
    """Clear a stuck hold from the desk. A piece marked held with no active hold behind it
    (written before holds existed, or by hand) is repaired by putting it back on sale."""
    with transaction.atomic():
        accession = Accession.objects.select_for_update().get(pk=accession.pk)
        if accession.status != AccessionStatus.HELD:
            raise ConflictError(f"{accession.archive_no} is not on hold.", code="no_hold")
        hold = _end_active_hold(accession, HoldStatus.RELEASED, now or timezone.now(), actor)
        if hold is None:
            _return_to_sale(accession)
    return hold


def expire_due(now=None) -> int:
    """End every hold whose time has run out and put its piece back on sale. Safe to run
    concurrently and repeatedly: each hold is re-checked under its piece's lock."""
    now = now or timezone.now()
    expired = 0
    due = Hold.objects.filter(status=HoldStatus.ACTIVE, expires_at__lte=now).values_list(
        "pk", "accession_id"
    )
    for hold_id, accession_id in list(due):
        with transaction.atomic():
            accession = Accession.objects.select_for_update().get(pk=accession_id)
            hold = Hold.objects.select_for_update().get(pk=hold_id)
            if hold.status != HoldStatus.ACTIVE or hold.expires_at > now:
                continue
            _end(hold, HoldStatus.EXPIRED, now)
            if accession.status == AccessionStatus.HELD:
                _return_to_sale(accession)
            expired += 1
    return expired


def visitor_holds(token: str, now=None) -> QuerySet[Hold]:
    now = now or timezone.now()
    return (
        Hold.objects.filter(
            visitor_key=visitor_key(token), status=HoldStatus.ACTIVE, expires_at__gt=now
        )
        .select_related("accession", "accession__drop")
        .prefetch_related("accession__images")
        .order_by("expires_at")
    )


def active_hold(accession: Accession) -> Hold | None:
    return accession.holds.filter(status=HoldStatus.ACTIVE).first()
