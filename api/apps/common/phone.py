import re

from django.core.exceptions import ValidationError

# Safaricom, Airtel and Telkom mobile ranges all sit under 7xx or 1xx after the country code.
_KENYAN_MOBILE = re.compile(r"^(?:\+?254|0)?([71]\d{8})$")


def normalise_kenyan_phone(value: str) -> str:
    """Return a Kenyan mobile number in E.164 form (+2547XXXXXXXX).

    Accepts 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX and 7XXXXXXXX, with spaces
    or dashes. Raises ValidationError for anything else."""
    compact = re.sub(r"[\s\-()]", "", value or "")
    match = _KENYAN_MOBILE.match(compact)
    if not match:
        raise ValidationError(
            "Enter a Kenyan mobile number, e.g. 0712 345 678.", code="invalid_phone"
        )
    return f"+254{match.group(1)}"
