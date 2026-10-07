from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Accession, AccessionImage
from apps.catalog.services import LOCKED_STATUSES


class Command(BaseCommand):
    help = "Delete every placeholder piece and its photo files. Held or claimed pieces are kept."

    def handle(self, *args, **options):
        storage = AccessionImage._meta.get_field("file").storage
        with transaction.atomic():
            pieces = list(Accession.objects.select_for_update().filter(is_placeholder=True))
            kept = [piece.archive_no for piece in pieces if piece.status in LOCKED_STATUSES]
            doomed = [piece.pk for piece in pieces if piece.status not in LOCKED_STATUSES]
            files = list(
                AccessionImage.objects.filter(accession_id__in=doomed).values_list(
                    "file", flat=True
                )
            )
            Accession.objects.filter(pk__in=doomed).delete()
            transaction.on_commit(lambda: [storage.delete(name) for name in files])

        self.stdout.write(self.style.SUCCESS(f"Deleted {len(doomed)} placeholder pieces."))
        if kept:
            self.stdout.write(
                self.style.WARNING(f"Kept {', '.join(kept)}: a sale is in progress or complete.")
            )
