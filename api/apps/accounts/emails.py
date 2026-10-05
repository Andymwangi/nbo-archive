from urllib.parse import urlencode

from django.conf import settings


def magic_link_url(raw_token: str) -> str:
    return f"{settings.WEB_BASE_URL}/admin/verify?{urlencode({'token': raw_token})}"


def magic_link_message(name: str, raw_token: str) -> tuple[str, str]:
    greeting = f"Habari {name}," if name else "Habari,"
    subject = "Your key to the archive room"
    body = (
        f"{greeting}\n\n"
        "Here is your sign-in link for the nboarchive back room. "
        f"It works once and expires in {settings.MAGIC_LINK_TTL_MINUTES} minutes.\n\n"
        f"{magic_link_url(raw_token)}\n\n"
        "If you did not ask for this, ignore it. Nobody gets in without the link.\n\n"
        "-- nboarchive\n"
    )
    return subject, body
