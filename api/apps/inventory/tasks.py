import logging

from celery import shared_task

from apps.inventory.services import expire_due

logger = logging.getLogger(__name__)


@shared_task
def expire_holds() -> None:
    """End holds whose 15 minutes have passed. Placing a hold also expires a lapsed one on the
    spot, so a buyer never waits on this task; it keeps stored statuses accurate."""
    expired = expire_due()
    if expired:
        logger.info("Expired %s hold(s).", expired)
