from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import AdminRole, AdminUser
from apps.catalog import services
from apps.catalog.models import Accession
from seed.accessions import SEED_ACCESSIONS

SEED_MEDIA = Path(settings.BASE_DIR) / "seed" / "media"


class Command(BaseCommand):
    help = "Create placeholder pieces from seed/accessions.py and the photos in seed/media/."

    def add_arguments(self, parser):
        parser.add_argument(
            "--draft", action="store_true", help="Leave the pieces as drafts instead of publishing."
        )

    def handle(self, *args, draft: bool, **options):
        if Accession.objects.filter(is_placeholder=True).exists():
            raise CommandError("Placeholders already exist. Run purge_placeholders first.")

        missing = sorted(
            {
                name
                for entry in SEED_ACCESSIONS
                for name, _ in entry["photos"]
                if not (SEED_MEDIA / name).is_file()
            }
        )
        if missing:
            raise CommandError(f"Add these photos to {SEED_MEDIA}: {', '.join(missing)}")

        owner = AdminUser.objects.filter(role=AdminRole.OWNER, is_active=True).first()
        cleaned_at = timezone.localdate() - timedelta(days=3)

        for entry in SEED_ACCESSIONS:
            accession = services.create_accession(
                actor=owner, is_placeholder=True, cleaned_at=cleaned_at, **entry["fields"]
            )
            photos = {}
            for name, kind in entry["photos"]:
                upload = SimpleUploadedFile(name, (SEED_MEDIA / name).read_bytes())
                photos[name] = services.add_image(accession, upload=upload, kind=kind)
            for description, photo in entry["flaws"]:
                services.add_flaw(accession, description=description, image=photos[photo])
            if not draft:
                services.publish_accession(accession)
            self.stdout.write(f"{accession.archive_no} {accession.title}")

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SEED_ACCESSIONS)} placeholder pieces."))
