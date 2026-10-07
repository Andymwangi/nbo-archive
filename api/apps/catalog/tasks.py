import logging

from celery import shared_task

from apps.catalog.services import release_due

logger = logging.getLogger(__name__)


@shared_task
def release_due_pieces() -> None:
    """Flip drops and pieces whose release time has passed. Visibility never waits on this
    task (public reads compare release times directly); it keeps stored statuses accurate."""
    drops, pieces = release_due()
    if drops or pieces:
        logger.info("Released %s drop(s) and %s piece(s).", drops, pieces)
