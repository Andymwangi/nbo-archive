import io
import struct
import threading
from datetime import date, timedelta

import pytest
from django.contrib import admin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from PIL import Image, ImageCms
from rest_framework.exceptions import NotFound, ValidationError

from apps.catalog import services
from apps.catalog.models import (
    Accession,
    AccessionImage,
    AccessionStatus,
    Drop,
    DropStatus,
    Flaw,
    Sequence,
)
from apps.catalog.specs import chest_band, format_archive_no, parse_archive_no
from apps.common.exceptions import ConflictError

pytestmark = pytest.mark.django_db

LIST_URL = reverse("catalog-list")
FACETS_URL = reverse("catalog-facets")
DROPS_URL = reverse("catalog-drops")
ADMIN_LIST_URL = reverse("admin-accessions")
ADMIN_DROPS_URL = reverse("admin-drops")

COMPLETE = {
    "title": "Navy pique polo",
    "category": "polo",
    "brand": "Lacoste",
    "tagged_size": "L",
    "colour": "Navy",
    "fabric_composition": "100% cotton",
    "condition_grade": "excellent",
    "measurements": {"chest": 55, "length": 72, "shoulder": 47, "sleeve": 22},
    "cleaned_at": date(2026, 10, 1),
    "price_kes": 2800,
}


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def _jpeg(width=800, height=600, colour=(30, 60, 90), exif=None, fmt="JPEG") -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGB", (width, height), colour)
    kwargs = {"exif": exif} if exif is not None else {}
    image.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


def _upload(name="photo.jpg", data=None, content_type="image/jpeg") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, data if data is not None else _jpeg(), content_type)


def _draft(actor=None, **fields) -> Accession:
    return services.create_accession(actor=actor, **{"category": "polo", **fields})


def _complete(actor=None, photos=3, **fields) -> Accession:
    accession = _draft(actor, **{**COMPLETE, **fields})
    kinds = ["front", "back", "tag", "care", "texture"]
    for index in range(photos):
        services.add_image(accession, upload=_upload(), kind=kinds[index % len(kinds)])
    return accession


def _live(actor=None, **fields) -> Accession:
    return services.publish_accession(_complete(actor, **fields))


def _detail_url(archive_no: str) -> str:
    return reverse("catalog-detail", kwargs={"archive_no": archive_no})


def _admin_url(name: str, accession: Accession, **extra) -> str:
    return reverse(name, kwargs={"pk": accession.pk, **extra})


class TestSpecs:
    @pytest.mark.parametrize(
        ("chest", "band"),
        [
            (None, ""),
            (40, "xs"),
            (47, "xs"),
            (48, "s"),
            (51, "s"),
            (52, "m"),
            (59, "l"),
            (60, "xl"),
            (63, "xl"),
            (64, "xxl"),
            (90, "xxl"),
        ],
    )
    def test_chest_band_edges(self, chest, band):
        assert chest_band(chest) == band

    @pytest.mark.parametrize(
        ("raw", "number"),
        [
            ("NBO-0142", 142),
            ("nbo-0142", 142),
            ("NBO0142", 142),
            ("0142", 142),
            ("142", 142),
            (" 7 ", 7),
            ("NBO-12345", 12345),
            ("0", None),
            ("NBO-", None),
            ("abc", None),
            ("142a", None),
            ("-1", None),
        ],
    )
    def test_parse_archive_no(self, raw, number):
        assert parse_archive_no(raw) == number

    def test_format_archive_no_pads_to_four_and_grows_past(self):
        assert format_archive_no(7) == "NBO-0007"
        assert format_archive_no(12345) == "NBO-12345"


class TestArchiveNumbers:
    def test_numbers_are_sequential_and_never_reused(self, editor):
        first = _draft(editor)
        second = _draft(editor)
        assert (first.archive_no, second.archive_no) == ("NBO-0001", "NBO-0002")

        services.delete_accession(second)
        assert _draft(editor).archive_no == "NBO-0003"

    def test_drop_numbers_have_their_own_sequence(self, editor):
        _draft(editor)
        assert services.create_drop(title="First").number == 1
        assert services.create_drop(title="Second").number == 2


@pytest.mark.concurrency
@pytest.mark.django_db(transaction=True)
def test_concurrent_drafts_get_distinct_numbers(editor):
    """Ten threads take archive numbers at once against real PostgreSQL row locks."""
    Sequence.objects.get_or_create(name=Sequence.ACCESSION)
    barrier = threading.Barrier(10)
    numbers: list[int] = []
    errors: list[Exception] = []
    lock = threading.Lock()

    def create():
        try:
            barrier.wait()
            accession = services.create_accession(actor=None, category="tee")
            with lock:
                numbers.append(accession.number)
        except Exception as exc:
            with lock:
                errors.append(exc)
        finally:
            connection.close()

    threads = [threading.Thread(target=create) for _ in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert sorted(numbers) == list(range(1, 11))


class TestPublicBrowse:
    def test_only_public_statuses_are_listed_and_claimed_is_opt_in(self, editor):
        live = _live(editor)
        held = _live(editor, title="Held")
        claimed = _live(editor, title="Claimed")
        Accession.objects.filter(pk=held.pk).update(status=AccessionStatus.HELD)
        Accession.objects.filter(pk=claimed.pk).update(status=AccessionStatus.CLAIMED)
        _draft(editor, title="Draft")
        withdrawn = services.withdraw_accession(_live(editor, title="Withdrawn"))
        future = services.schedule_accession(
            _complete(editor, title="Future"), release_at=timezone.now() + timedelta(days=1)
        )

        client_rows = self._archive_nos(LIST_URL)
        assert client_rows == {live.archive_no, held.archive_no}
        assert withdrawn.archive_no not in client_rows
        assert future.archive_no not in client_rows

        with_claimed = self._archive_nos(LIST_URL + "?include_claimed=true")
        assert with_claimed == {live.archive_no, held.archive_no, claimed.archive_no}

    def test_scheduled_piece_is_public_once_its_time_passes(self, editor):
        piece = services.schedule_accession(
            _complete(editor), release_at=timezone.now() + timedelta(minutes=5)
        )
        Accession.objects.filter(pk=piece.pk).update(
            release_at=timezone.now() - timedelta(seconds=1)
        )

        response = self._get(_detail_url(piece.archive_no))
        assert response.status_code == 200
        assert response.json()["status"] == "live"

    def test_filters_and_sort(self, editor):
        cheap = _live(editor, price_kes=1500, brand="Fila", colour="Red", era="90s")
        dear = _live(
            editor,
            category="tee",
            price_kes=4200,
            brand="fila",
            measurements={"chest": 61, "length": 74, "shoulder": 52, "sleeve": 21},
        )
        other = _live(editor, brand="Nike", price_kes=3000)

        assert self._archive_nos(LIST_URL + "?category=tee") == {dear.archive_no}
        assert self._archive_nos(LIST_URL + "?category=tee&category=polo") == {
            cheap.archive_no,
            dear.archive_no,
            other.archive_no,
        }
        assert self._archive_nos(LIST_URL + "?brand=FILA") == {cheap.archive_no, dear.archive_no}
        assert self._archive_nos(LIST_URL + "?brand=fila,nike") == {
            cheap.archive_no,
            dear.archive_no,
            other.archive_no,
        }
        assert self._archive_nos(LIST_URL + "?size=xl") == {dear.archive_no}
        assert self._archive_nos(LIST_URL + "?price_min=2000&price_max=3500") == {other.archive_no}
        assert self._archive_nos(LIST_URL + "?era=90S") == {cheap.archive_no}

        by_price = [
            row["archive_no"] for row in self._get(LIST_URL + "?sort=price").json()["results"]
        ]
        assert by_price == [cheap.archive_no, other.archive_no, dear.archive_no]
        newest = [row["archive_no"] for row in self._get(LIST_URL).json()["results"]]
        assert newest[0] == other.archive_no

    def test_invalid_filter_value_is_a_validation_error(self):
        response = self._get(LIST_URL + "?category=sneakers")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"
        assert "category" in response.json()["error"]["fields"]

    def test_card_uses_front_photo_as_cover(self, editor):
        piece = _live(editor)
        row = self._get(LIST_URL).json()["results"][0]
        front = piece.images.get(kind="front")
        assert row["cover"]["id"] == front.pk
        assert row["cover"]["url"].startswith("http://testserver/media/accessions/")
        assert row["cover"]["placeholder"].startswith("data:image/jpeg;base64,")

    def test_detail_accepts_any_archive_number_spelling(self, editor):
        piece = _live(editor)
        for spelling in (piece.archive_no, piece.archive_no.lower(), str(piece.number), "0001"):
            assert self._get(_detail_url(spelling)).status_code == 200
        assert self._get(_detail_url("not-a-number")).status_code == 404

    def test_detail_hides_drafts(self, editor):
        draft = _draft(editor)
        response = self._get(_detail_url(draft.archive_no))
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_detail_shows_claimed_record_and_related_by_era(self, editor):
        piece = _live(editor, era="90s")
        sibling = _live(editor, era="90s", title="Sibling")
        claimed_sibling = _live(editor, era="90s", title="Gone")
        _live(editor, era="00s", title="Elsewhere")
        Accession.objects.filter(pk=claimed_sibling.pk).update(
            status=AccessionStatus.CLAIMED, claimed_city="Kisumu", claimed_at=timezone.now()
        )

        body = self._get(_detail_url(piece.archive_no)).json()
        assert [row["archive_no"] for row in body["related"]] == [sibling.archive_no]
        assert body["claimed"] is None

        claimed = self._get(_detail_url(claimed_sibling.archive_no)).json()
        assert claimed["status"] == "claimed"
        assert claimed["claimed"]["city"] == "Kisumu"

    def test_facets_count_browsable_pieces_only(self, editor):
        _live(editor, brand="Fila", price_kes=1500)
        _live(editor, brand="fila", price_kes=3000)
        gone = _live(editor, brand="Nike", price_kes=9000)
        Accession.objects.filter(pk=gone.pk).update(status=AccessionStatus.CLAIMED)
        _draft(editor, brand="Draftbrand")

        body = self._get(FACETS_URL).json()
        assert body["brand"] == [{"value": "Fila", "count": 2}]
        assert body["category"] == [{"value": "polo", "count": 2}]
        assert body["chest_band"] == [{"value": "m", "count": 2}]
        assert (body["price_min"], body["price_max"]) == (1500, 3000)

    def test_public_endpoints_ignore_bearer_tokens(self, auth_client, packer):
        assert auth_client(packer).get(LIST_URL).status_code == 200

    @staticmethod
    def _get(url):
        from rest_framework.test import APIClient

        return APIClient().get(url)

    def _archive_nos(self, url) -> set[str]:
        response = self._get(url)
        assert response.status_code == 200, response.content
        return {row["archive_no"] for row in response.json()["results"]}


class TestPublicDrops:
    def test_draft_drops_are_hidden_and_scheduled_ones_tease(self, api_client, editor):
        services.create_drop(title="Hidden")
        teaser = services.schedule_drop(
            services.create_drop(title="Soon"), release_at=timezone.now() + timedelta(days=2)
        )
        piece = _complete(editor)
        services.update_accession(piece, drop=teaser)
        services.schedule_accession(piece)

        rows = api_client.get(DROPS_URL).json()["results"]
        assert [(row["number"], row["released"], row["piece_count"]) for row in rows] == [
            (teaser.number, False, 1)
        ]
        detail = api_client.get(reverse("catalog-drop-detail", kwargs={"number": teaser.number}))
        assert detail.status_code == 200
        assert api_client.get(LIST_URL + f"?drop={teaser.number}").json()["count"] == 0
        hidden = reverse("catalog-drop-detail", kwargs={"number": 1})
        assert api_client.get(hidden).status_code == 404


class TestAdminAccess:
    def test_requires_sign_in(self, api_client):
        response = api_client.get(ADMIN_LIST_URL)
        assert response.status_code == 401

    def test_packer_reads_but_cannot_write(self, auth_client, packer):
        client = auth_client(packer)
        assert client.get(ADMIN_LIST_URL).status_code == 200
        response = client.post(ADMIN_LIST_URL, {"category": "tee"}, format="json")
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "permission_denied"

    @pytest.mark.parametrize("role", ["owner", "editor"])
    def test_owner_and_editor_can_create(self, auth_client, role, request):
        user = request.getfixturevalue(role)
        response = auth_client(user).post(ADMIN_LIST_URL, {"category": "tee"}, format="json")
        assert response.status_code == 201
        body = response.json()
        assert body["archive_no"] == "NBO-0001"
        assert body["status"] == "draft"
        assert body["created_by"] == user.email
        assert "images" in body["problems"]


class TestAdminEditing:
    def test_measurements_validate_and_derive_chest_band(self, auth_client, editor):
        client = auth_client(editor)
        piece = _draft(editor)
        url = _admin_url("admin-accession-detail", piece)

        bad = client.patch(url, {"measurements": {"chest": "55"}}, format="json")
        assert bad.status_code == 400
        assert "measurements" in bad.json()["error"]["fields"]
        unknown = client.patch(url, {"measurements": {"waist": 40}}, format="json")
        assert unknown.status_code == 400

        ok = client.patch(url, {"measurements": {"chest": 58, "length": 70}}, format="json")
        assert ok.status_code == 200
        assert ok.json()["chest_band"] == "l"

    def test_category_extras_follow_the_category(self, auth_client, editor):
        client = auth_client(editor)
        piece = _draft(editor)
        url = _admin_url("admin-accession-detail", piece)

        wrong = client.patch(url, {"category_extras": {"fibre": "wool"}}, format="json")
        assert wrong.status_code == 400
        bad_choice = client.patch(url, {"category_extras": {"knit_type": "mesh"}}, format="json")
        assert bad_choice.status_code == 400

        ok = client.patch(
            url,
            {"category_extras": {"knit_type": "pique", "collar_condition": "Crisp"}},
            format="json",
        )
        assert ok.json()["category_extras"] == {"knit_type": "pique", "collar_condition": "Crisp"}

        switched = client.patch(url, {"category": "sweater"}, format="json")
        assert switched.json()["category_extras"] == {}

    def test_held_or_claimed_pieces_are_frozen(self, auth_client, editor):
        piece = _live(editor)
        Accession.objects.filter(pk=piece.pk).update(status=AccessionStatus.HELD)
        client = auth_client(editor)

        response = client.patch(
            _admin_url("admin-accession-detail", piece), {"price_kes": 1}, format="json"
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "conflict"
        assert client.post(_admin_url("admin-accession-withdraw", piece)).status_code == 409

    def test_only_drafts_can_be_deleted(self, auth_client, editor):
        client = auth_client(editor)
        live = _live(editor)
        assert client.delete(_admin_url("admin-accession-detail", live)).status_code == 409

        draft = _draft(editor)
        assert client.delete(_admin_url("admin-accession-detail", draft)).status_code == 204
        assert not Accession.objects.filter(pk=draft.pk).exists()

    def test_deleting_a_draft_removes_its_photo_files(
        self, editor, django_capture_on_commit_callbacks
    ):
        draft = _draft(editor)
        image = services.add_image(draft, upload=_upload(), kind="front")
        storage, name = image.file.storage, image.file.name
        assert storage.exists(name)

        with django_capture_on_commit_callbacks(execute=True):
            services.delete_accession(draft)
        assert not storage.exists(name)

    def test_admin_search_matches_number_title_and_brand(self, auth_client, editor):
        first = _draft(editor, title="Corduroy jacket", category="jacket")
        _draft(editor, brand="Carhartt")
        client = auth_client(editor)

        def found(query):
            return {
                row["archive_no"]
                for row in client.get(ADMIN_LIST_URL, {"q": query}).json()["results"]
            }

        assert found("corduroy") == {first.archive_no}
        assert found("NBO-0001") == {first.archive_no}
        assert len(found("carhartt")) == 1


class TestPublishing:
    def test_publish_lists_every_problem(self, auth_client, editor):
        piece = _draft(editor)
        response = auth_client(editor).post(_admin_url("admin-accession-publish", piece))

        assert response.status_code == 400
        fields = response.json()["error"]["fields"]
        for field in ("title", "brand", "price_kes", "cleaned_at", "measurements", "images"):
            assert field in fields

    def test_publish_complete_piece(self, auth_client, editor):
        piece = _complete(editor)
        response = auth_client(editor).post(_admin_url("admin-accession-publish", piece))

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "live"
        assert body["published_at"] is not None
        assert body["problems"] == {}

    def test_publish_needs_a_front_photo_and_three_photos(self, editor):
        piece = _draft(editor, **COMPLETE)
        for kind in ("back", "tag", "care"):
            services.add_image(piece, upload=_upload(), kind=kind)
        assert services.publication_problems(piece) == {"images": ["Add a front photo."]}

    def test_every_flaw_needs_a_photo(self, editor):
        piece = _complete(editor)
        services.add_flaw(piece, description="Small mark on left cuff")
        assert "flaws" in services.publication_problems(piece)

        flaw_photo = services.add_image(piece, upload=_upload(), kind="flaw")
        flaw = piece.flaws.get()
        services.update_flaw(flaw, image=flaw_photo)
        assert services.publication_problems(piece) == {}

    def test_flaw_photo_must_belong_to_the_same_piece(self, auth_client, editor):
        piece = _complete(editor)
        other = _complete(editor)
        foreign = other.images.first()
        response = auth_client(editor).post(
            _admin_url("admin-accession-flaws", piece),
            {"description": "Pull on hem", "image_id": foreign.pk},
            format="json",
        )
        assert response.status_code == 400
        assert "image" in response.json()["error"]["fields"]

    def test_withdraw_and_republish(self, editor):
        piece = _live(editor)
        assert services.withdraw_accession(piece).status == AccessionStatus.WITHDRAWN
        assert services.publish_accession(piece).status == AccessionStatus.LIVE

    def test_withdrawing_a_draft_is_a_conflict(self, auth_client, editor):
        piece = _draft(editor)
        assert (
            auth_client(editor).post(_admin_url("admin-accession-withdraw", piece)).status_code
            == 409
        )


class TestScheduling:
    def test_schedule_requires_future_time(self, auth_client, editor):
        piece = _complete(editor)
        client = auth_client(editor)
        url = _admin_url("admin-accession-schedule", piece)

        assert client.post(url, {}, format="json").status_code == 400
        past = (timezone.now() - timedelta(minutes=1)).isoformat()
        assert client.post(url, {"release_at": past}, format="json").status_code == 400

        future = timezone.now() + timedelta(hours=3)
        response = client.post(url, {"release_at": future.isoformat()}, format="json")
        assert response.status_code == 200
        assert response.json()["status"] == "scheduled"

    def test_release_due_promotes_scheduled_pieces(self, editor):
        release_at = timezone.now() + timedelta(hours=1)
        piece = services.schedule_accession(_complete(editor), release_at=release_at)

        assert services.release_due(now=release_at - timedelta(seconds=1)) == (0, 0)
        assert services.release_due(now=release_at) == (0, 1)
        piece.refresh_from_db()
        assert piece.status == AccessionStatus.LIVE
        assert piece.published_at == release_at

    def test_release_due_leaves_a_piece_that_was_held_first(self, editor):
        release_at = timezone.now() + timedelta(hours=1)
        piece = services.schedule_accession(_complete(editor), release_at=release_at)
        Accession.objects.filter(pk=piece.pk).update(status=AccessionStatus.HELD)

        services.release_due(now=release_at)
        piece.refresh_from_db()
        assert piece.status == AccessionStatus.HELD


class TestDrops:
    def test_drop_lifecycle_carries_its_pieces(self, auth_client, editor):
        client = auth_client(editor)
        created = client.post(
            ADMIN_DROPS_URL, {"title": "Accession 01", "intro": "Wool."}, format="json"
        )
        assert created.status_code == 201
        drop = Drop.objects.get(pk=created.json()["id"])

        piece = _complete(editor)
        services.update_accession(piece, drop=drop)
        schedule_piece = _admin_url("admin-accession-schedule", piece)
        assert client.post(schedule_piece, {}, format="json").status_code == 409

        first_time = timezone.now() + timedelta(days=1)
        response = client.post(
            reverse("admin-drop-schedule", kwargs={"pk": drop.pk}),
            {"release_at": first_time.isoformat()},
            format="json",
        )
        assert response.status_code == 200
        assert client.post(schedule_piece, {}, format="json").status_code == 200
        assert client.post(_admin_url("admin-accession-publish", piece)).status_code == 409

        moved = first_time + timedelta(days=1)
        services.schedule_drop(drop, release_at=moved)
        piece.refresh_from_db()
        assert piece.release_at == moved

        released = client.post(reverse("admin-drop-release", kwargs={"pk": drop.pk}))
        assert released.status_code == 200
        assert released.json()["status"] == "released"
        assert released.json()["piece_count"] == 1
        piece.refresh_from_db()
        assert piece.status == AccessionStatus.LIVE

    def test_changing_drop_of_scheduled_piece_is_a_conflict(self, editor):
        drop = services.schedule_drop(
            services.create_drop(title="A"), release_at=timezone.now() + timedelta(days=1)
        )
        piece = _complete(editor)
        services.update_accession(piece, drop=drop)
        services.schedule_accession(piece)

        with pytest.raises(ConflictError) as excinfo:
            services.update_accession(piece, drop=None)
        assert excinfo.value.status_code == 409

    def test_release_due_releases_drops(self, editor):
        release_at = timezone.now() + timedelta(hours=2)
        drop = services.schedule_drop(services.create_drop(title="B"), release_at=release_at)
        piece = _complete(editor)
        services.update_accession(piece, drop=drop)
        services.schedule_accession(piece)

        assert services.release_due(now=release_at) == (1, 0)
        drop.refresh_from_db()
        piece.refresh_from_db()
        assert drop.status == DropStatus.RELEASED
        assert drop.release_at == release_at
        assert piece.status == AccessionStatus.LIVE

    def test_only_draft_drops_can_be_deleted_and_pieces_survive(self, auth_client, editor):
        client = auth_client(editor)
        drop = services.create_drop(title="Draft drop")
        piece = _draft(editor)
        services.update_accession(piece, drop=drop)

        assert (
            client.delete(reverse("admin-drop-detail", kwargs={"pk": drop.pk})).status_code == 204
        )
        piece.refresh_from_db()
        assert piece.drop is None

        scheduled = services.schedule_drop(
            services.create_drop(title="Out soon"), release_at=timezone.now() + timedelta(days=1)
        )
        url = reverse("admin-drop-detail", kwargs={"pk": scheduled.pk})
        assert client.delete(url).status_code == 409


class TestImages:
    def test_upload_strips_metadata_and_applies_orientation(self, auth_client, editor):
        exif = Image.Exif()
        exif[0x0112] = 6  # Orientation: rotate 90 degrees clockwise to display
        exif[0x010F] = "SecretCam"  # Make
        piece = _draft(editor)

        response = auth_client(editor).post(
            _admin_url("admin-accession-images", piece),
            {"file": _upload(data=_jpeg(800, 600, exif=exif)), "kind": "front"},
            format="multipart",
        )

        assert response.status_code == 201, response.content
        body = response.json()
        assert (body["width"], body["height"]) == (600, 800)
        stored = AccessionImage.objects.get(pk=body["id"])
        with stored.file.open("rb") as handle, Image.open(handle) as saved:
            assert saved.format == "JPEG"
            assert dict(saved.getexif()) == {}
            assert saved.size == (600, 800)

    def test_large_photos_are_capped_and_png_is_accepted(self, editor):
        piece = _draft(editor)
        image = services.add_image(
            piece,
            upload=_upload("big.png", _jpeg(3000, 1500, fmt="PNG"), "image/png"),
            kind="back",
        )
        assert (image.width, image.height) == (2400, 1200)
        assert image.file.name.endswith(".jpg")

    @pytest.mark.parametrize(
        ("name", "data"),
        [("notes.jpg", b"definitely not an image"), ("anim.gif", None)],
    )
    def test_rejects_non_photos(self, auth_client, editor, name, data):
        if data is None:
            data = _jpeg(fmt="GIF")
        piece = _draft(editor)
        response = auth_client(editor).post(
            _admin_url("admin-accession-images", piece),
            {"file": _upload(name, data), "kind": "front"},
            format="multipart",
        )
        assert response.status_code == 400
        assert "file" in response.json()["error"]["fields"]
        assert AccessionImage.objects.count() == 0

    def test_photo_limit_is_enforced_and_leaves_no_orphan_file(self, editor, settings):
        piece = _draft(editor)
        for _ in range(services.MAX_IMAGES):
            services.add_image(piece, upload=_upload(), kind="texture")
        before = set((settings.MEDIA_ROOT / "accessions").iterdir())

        with pytest.raises(ValidationError) as excinfo:
            services.add_image(piece, upload=_upload(), kind="texture")
        assert excinfo.value.status_code == 400
        assert set((settings.MEDIA_ROOT / "accessions").iterdir()) == before

    def test_reorder_and_delete(self, auth_client, editor, django_capture_on_commit_callbacks):
        piece = _complete(editor)
        ids = list(piece.images.values_list("pk", flat=True))
        client = auth_client(editor)
        order_url = _admin_url("admin-accession-image-order", piece)

        assert client.post(order_url, {"ids": ids[:2]}, format="json").status_code == 400
        reordered = client.post(order_url, {"ids": ids[::-1]}, format="json")
        assert [row["id"] for row in reordered.json()] == ids[::-1]

        doomed = AccessionImage.objects.get(pk=ids[0])
        storage, name = doomed.file.storage, doomed.file.name
        with django_capture_on_commit_callbacks(execute=True):
            response = client.delete(
                _admin_url("admin-accession-image-detail", piece, image_id=doomed.pk)
            )
        assert response.status_code == 204
        assert not storage.exists(name)

    def test_image_of_another_piece_is_not_found(self, auth_client, editor):
        piece = _complete(editor)
        other = _complete(editor)
        url = _admin_url("admin-accession-image-detail", piece, image_id=other.images.first().pk)
        assert auth_client(editor).delete(url).status_code == 404

    def test_flaw_photo_deletion_unlinks_flaw(self, editor):
        piece = _complete(editor)
        photo = services.add_image(piece, upload=_upload(), kind="flaw")
        flaw = services.add_flaw(piece, description="Pinhole", image=photo)
        services.delete_image(photo)
        flaw.refresh_from_db()
        assert flaw.image is None
        assert Flaw.objects.count() == 1


class TestSeedCommands:
    def test_seed_refuses_when_photos_are_missing(self, monkeypatch, tmp_path):
        from django.core.management import CommandError, call_command

        from apps.catalog.management.commands import seed_archive

        monkeypatch.setattr(seed_archive, "SEED_MEDIA", tmp_path / "empty")
        with pytest.raises(CommandError, match="polo-front.jpg"):
            call_command("seed_archive")
        assert Accession.objects.count() == 0

    def test_seed_then_purge(
        self, owner, monkeypatch, tmp_path, django_capture_on_commit_callbacks
    ):
        from django.core.management import CommandError, call_command

        from apps.catalog.management.commands import seed_archive
        from seed.accessions import SEED_ACCESSIONS

        photos = tmp_path / "seed-photos"
        photos.mkdir()
        for entry in SEED_ACCESSIONS:
            for name, _ in entry["photos"]:
                (photos / name).write_bytes(_jpeg())
        monkeypatch.setattr(seed_archive, "SEED_MEDIA", photos)

        call_command("seed_archive", stdout=io.StringIO())
        seeded = Accession.objects.all()
        assert seeded.count() == len(SEED_ACCESSIONS)
        assert all(p.is_placeholder and p.status == AccessionStatus.LIVE for p in seeded)
        assert all(p.created_by == owner for p in seeded)
        assert Flaw.objects.filter(image__isnull=False).count() == 2
        with pytest.raises(CommandError):
            call_command("seed_archive", stdout=io.StringIO())

        held = seeded.first()
        Accession.objects.filter(pk=held.pk).update(status=AccessionStatus.HELD)
        files = [image.file.name for image in AccessionImage.objects.exclude(accession=held)]
        storage = AccessionImage._meta.get_field("file").storage

        out = io.StringIO()
        with django_capture_on_commit_callbacks(execute=True):
            call_command("purge_placeholders", stdout=out)
        assert list(Accession.objects.values_list("pk", flat=True)) == [held.pk]
        assert held.archive_no in out.getvalue()
        assert not any(storage.exists(name) for name in files)


class TestPublicPiecesStayComplete:
    def test_live_piece_cannot_lose_required_details(self, auth_client, editor):
        piece = _live(editor)
        client = auth_client(editor)
        url = _admin_url("admin-accession-detail", piece)

        response = client.patch(url, {"price_kes": None}, format="json")
        assert response.status_code == 400
        assert "price_kes" in response.json()["error"]["fields"]
        piece.refresh_from_db()
        assert piece.price_kes == COMPLETE["price_kes"]

        draft = _draft(editor)
        draft_url = _admin_url("admin-accession-detail", draft)
        assert client.patch(draft_url, {"price_kes": None}, format="json").status_code == 200

    def test_live_piece_keeps_its_front_photo(self, auth_client, editor):
        piece = _live(editor)
        front = piece.images.get(kind="front")
        client = auth_client(editor)
        detail = _admin_url("admin-accession-image-detail", piece, image_id=front.pk)

        assert client.delete(detail).status_code == 400
        assert client.patch(detail, {"kind": "back"}, format="json").status_code == 400
        assert AccessionImage.objects.filter(pk=front.pk, kind="front").exists()

    def test_flaw_on_live_piece_needs_its_photo_up_front(self, editor):
        piece = _live(editor)
        with pytest.raises(ValidationError) as excinfo:
            services.add_flaw(piece, description="Hole near hem")
        assert excinfo.value.status_code == 400
        assert piece.flaws.count() == 0

        photo = services.add_image(piece, upload=_upload(), kind="flaw")
        services.add_flaw(piece, description="Hole near hem", image=photo)
        photo_pk = photo.pk
        with pytest.raises(ValidationError):
            services.delete_image(photo)
        assert piece.flaws.get().image_id == photo_pk

    def test_live_piece_cannot_join_an_unreleased_drop(self, editor):
        upcoming = services.schedule_drop(
            services.create_drop(title="Soon"), release_at=timezone.now() + timedelta(days=1)
        )
        released = services.release_drop(services.create_drop(title="Out"))
        piece = _live(editor)

        with pytest.raises(ConflictError) as excinfo:
            services.update_accession(piece, drop=upcoming)
        assert excinfo.value.status_code == 409
        assert services.update_accession(piece, drop=released).drop == released


def _display_p3_profile() -> bytes:
    """Display P3: the sRGB profile from Pillow with its primaries swapped for P3 (D50)."""
    data = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes())
    primaries = {
        b"rXYZ": (0.5151, 0.2412, -0.0011),
        b"gXYZ": (0.2919, 0.6922, 0.0419),
        b"bXYZ": (0.1572, 0.0666, 0.7841),
    }
    (count,) = struct.unpack(">I", data[128:132])
    patched = 0
    for index in range(count):
        signature, offset, _ = struct.unpack(">4sII", data[132 + 12 * index : 144 + 12 * index])
        if signature in primaries:
            values = (round(value * 65536) for value in primaries[signature])
            data[offset + 8 : offset + 20] = struct.pack(">3i", *values)
            patched += 1
    assert patched == 3
    return bytes(data)


def _tagged_jpeg(colour, icc_profile) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), colour).save(
        buffer, format="JPEG", quality=100, icc_profile=icc_profile
    )
    return buffer.getvalue()


def _stored_pixel(image: AccessionImage):
    with image.file.open("rb") as handle, Image.open(handle) as saved:
        assert "icc_profile" not in saved.info
        return saved.getpixel((saved.width // 2, saved.height // 2))


class TestColourProfiles:
    def test_wide_gamut_photo_is_converted_to_srgb(self, editor):
        image = services.add_image(
            _draft(editor),
            upload=_upload(data=_tagged_jpeg((200, 100, 50), _display_p3_profile())),
            kind="front",
        )
        red, _, blue = _stored_pixel(image)
        # P3 orange is more saturated than the same numbers read as sRGB.
        assert red >= 210 and blue <= 35

    @pytest.mark.parametrize(
        "profile",
        [None, ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes(), b"garbage"],
        ids=["untagged", "srgb", "damaged"],
    )
    def test_srgb_untagged_and_damaged_profiles_keep_their_colours(self, editor, profile):
        image = services.add_image(
            _draft(editor), upload=_upload(data=_tagged_jpeg((200, 100, 50), profile)), kind="front"
        )
        pixel = _stored_pixel(image)
        assert all(abs(a - b) <= 2 for a, b in zip(pixel, (200, 100, 50), strict=True))


class TestStaleWrites:
    """Views load a row before the service locks it; the service must write from the committed
    row, not from that earlier copy."""

    def test_editing_a_deleted_photo_is_not_found_and_does_not_restore_it(self, editor):
        piece = _complete(editor, photos=4)
        stale = AccessionImage.objects.get(accession=piece, kind="care")
        services.delete_image(AccessionImage.objects.get(pk=stale.pk))

        with pytest.raises(NotFound):
            services.update_image(stale, alt_text="Care label")
        assert not AccessionImage.objects.filter(pk=stale.pk).exists()

    def test_editing_a_photo_keeps_a_concurrent_reorder(self, editor):
        piece = _complete(editor)
        ids = list(piece.images.order_by("position").values_list("pk", flat=True))
        stale = AccessionImage.objects.get(pk=ids[0])
        services.reorder_images(piece, ids[::-1])

        services.update_image(stale, alt_text="Front, buttoned")
        stale.refresh_from_db()
        assert (stale.position, stale.alt_text) == (2, "Front, buttoned")

    def test_editing_a_deleted_flaw_is_not_found_and_does_not_restore_it(self, editor):
        piece = _draft(editor)
        stale = services.add_flaw(piece, description="Pinhole")
        services.delete_flaw(Flaw.objects.get(pk=stale.pk))

        with pytest.raises(NotFound):
            services.update_flaw(stale, description="Two pinholes")
        with pytest.raises(NotFound):
            services.delete_flaw(stale)
        assert Flaw.objects.count() == 0

    def test_editing_a_drop_does_not_undo_its_release(self, editor):
        drop = services.schedule_drop(
            services.create_drop(title="Soon"), release_at=timezone.now() + timedelta(days=1)
        )
        stale = Drop.objects.get(pk=drop.pk)
        services.release_drop(drop)

        services.update_drop(stale, title="Out now")
        drop.refresh_from_db()
        assert (drop.status, drop.title) == (DropStatus.RELEASED, "Out now")

    def test_acting_on_a_deleted_piece_is_not_found(self, editor):
        piece = _draft(editor, **COMPLETE)
        stale = Accession.objects.get(pk=piece.pk)
        services.delete_accession(piece)

        for action in (
            lambda: services.update_accession(stale, title="Gone"),
            lambda: services.publish_accession(stale),
            lambda: services.add_flaw(stale, description="Hole"),
            lambda: services.add_image(stale, upload=_upload(), kind="front"),
        ):
            with pytest.raises(NotFound):
                action()


class TestReviewFixes:
    def test_scheduling_a_live_piece_is_a_conflict(self, auth_client, editor):
        piece = _live(editor)
        published_at = piece.published_at
        future = (timezone.now() + timedelta(days=7)).isoformat()

        response = auth_client(editor).post(
            _admin_url("admin-accession-schedule", piece), {"release_at": future}, format="json"
        )
        assert response.status_code == 409
        piece.refresh_from_db()
        assert (piece.status, piece.published_at) == (AccessionStatus.LIVE, published_at)

    def test_withdrawn_piece_can_still_be_scheduled(self, editor):
        piece = services.withdraw_accession(_live(editor))
        release_at = timezone.now() + timedelta(days=1)
        assert services.schedule_accession(piece, release_at=release_at).status == "scheduled"

    def test_new_photos_and_flaws_go_after_the_last_position(self, editor):
        piece = _complete(editor)
        services.delete_image(piece.images.get(position=0))
        added = services.add_image(piece, upload=_upload(), kind="texture")
        positions = list(piece.images.order_by("position").values_list("position", flat=True))
        assert added.position == 3
        assert len(positions) == len(set(positions))

        first = services.add_flaw(piece, description="Pinhole")
        services.add_flaw(piece, description="Fading")
        services.delete_flaw(first)
        assert services.add_flaw(piece, description="Loose thread").position == 2

    def test_reorder_moves_updated_at(self, editor):
        piece = _complete(editor)
        ids = list(piece.images.order_by("position").values_list("pk", flat=True))
        before = AccessionImage.objects.get(pk=ids[0]).updated_at

        services.reorder_images(piece, ids[::-1])
        assert AccessionImage.objects.get(pk=ids[0]).updated_at > before

    def test_upload_to_a_frozen_or_full_piece_is_rejected_before_processing(
        self, editor, monkeypatch
    ):
        held = _live(editor)
        Accession.objects.filter(pk=held.pk).update(status=AccessionStatus.HELD)
        full = _draft(editor)
        for _ in range(services.MAX_IMAGES):
            services.add_image(full, upload=_upload(), kind="texture")

        def fail(upload):
            raise AssertionError("the photo was processed")

        monkeypatch.setattr(services, "process_upload", fail)
        with pytest.raises(ConflictError):
            services.add_image(held, upload=_upload(), kind="texture")
        with pytest.raises(ValidationError):
            services.add_image(full, upload=_upload(), kind="texture")

    def test_taking_a_number_moves_the_sequence_timestamp(self, editor):
        _draft(editor)
        before = Sequence.objects.get(name=Sequence.ACCESSION).updated_at
        _draft(editor)
        assert Sequence.objects.get(name=Sequence.ACCESSION).updated_at > before

    @pytest.mark.parametrize("model", [Accession, AccessionImage, Flaw, Drop, Sequence])
    def test_django_admin_is_read_only(self, owner, model):
        request = RequestFactory().get("/")
        request.user = owner
        model_admin = admin.site._registry.get(model)
        if model_admin is None:
            accession_admin = admin.site._registry[Accession]
            model_admin = next(
                inline(Accession, admin.site)
                for inline in accession_admin.inlines
                if inline.model is model
            )
        assert not model_admin.has_add_permission(request)
        assert not model_admin.has_change_permission(request)
        assert not model_admin.has_delete_permission(request)
