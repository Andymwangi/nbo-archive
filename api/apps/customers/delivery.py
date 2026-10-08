"""How a sign-in code reaches the customer. Email is the only channel until the business can
register an SMS sender ID; SMS slots in here (Africa's Talking, Celcom or Firebase) without
touching the code flow around it."""

from django.conf import settings
from django.core.mail import send_mail

from apps.customers.models import CodeChannel


def code_email(code: str) -> tuple[str, str]:
    minutes = settings.CUSTOMER_CODE_TTL_MINUTES
    subject = f"{code} is your nboarchive sign-in code"
    body = (
        f"Your nboarchive sign-in code is {code}\n\n"
        f"It works once, for {minutes} minutes. Type it on the sign-in page to carry on.\n\n"
        "If you did not ask for this, you can ignore this email. Nobody can sign in without the "
        "code.\n\n"
        "-- nboarchive\n"
    )
    return subject, body


def deliver_code(channel: str, destination: str, code: str) -> None:
    if channel == CodeChannel.EMAIL:
        subject, body = code_email(code)
        send_mail(subject, body, None, [destination], fail_silently=False)
        return
    raise NotImplementedError(f"No delivery provider is configured for {channel}.")
