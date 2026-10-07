"""Garment rules from the catalog brief: which measurements and extra fields each category
takes, how measured chest maps to a size band, and how archive numbers are written."""

import re

ARCHIVE_PREFIX = "NBO-"
ARCHIVE_DIGITS = 4

# Every category is measured flat, in whole centimetres.
MEASUREMENT_KEYS = ("chest", "length", "shoulder", "sleeve")
MEASUREMENT_MIN_CM = 1
MEASUREMENT_MAX_CM = 200

# Extra fields per category. A tuple lists the accepted values; None means short free text.
CATEGORY_EXTRAS: dict[str, dict[str, tuple[str, ...] | None]] = {
    "polo": {
        "collar_condition": None,
        "placket_condition": None,
        "knit_type": ("pique", "jersey"),
    },
    "jacket": {
        "jacket_type": None,
        "closure_condition": None,
        "lining_condition": None,
        "insulation": None,
    },
    "sweater": {
        "fibre": ("wool", "cotton", "acrylic", "blend"),
        "pilling_level": ("none", "light", "moderate", "heavy"),
        "neckline": ("crew", "v-neck", "quarter-zip", "cardigan"),
    },
    "hoodie": {
        "style": ("zip", "pullover"),
        "hood_condition": None,
        "print_condition": None,
        "fleece_weight": None,
    },
    "tee": {
        "graphic": ("graphic", "plain"),
        "print_condition": None,
        "stitch": ("single", "double"),
    },
}
EXTRA_TEXT_MAX = 80

# Pit-to-pit chest in centimetres. Each band is [lower, upper); the last band is open-ended.
# Provisional edges until the owner confirms them.
CHEST_BANDS: tuple[tuple[str, int | None, int | None], ...] = (
    ("xs", None, 48),
    ("s", 48, 52),
    ("m", 52, 56),
    ("l", 56, 60),
    ("xl", 60, 64),
    ("xxl", 64, None),
)

_ARCHIVE_NO_RE = re.compile(r"^(?:NBO-?)?0*(\d{1,9})$", re.IGNORECASE)


def chest_band(chest_cm: int | None) -> str:
    if chest_cm is None:
        return ""
    for band, lower, upper in CHEST_BANDS:
        if (lower is None or chest_cm >= lower) and (upper is None or chest_cm < upper):
            return band
    return ""


def format_archive_no(number: int) -> str:
    return f"{ARCHIVE_PREFIX}{number:0{ARCHIVE_DIGITS}d}"


def parse_archive_no(value: str) -> int | None:
    """Accept `NBO-0142`, `nbo0142`, `0142` or `142`. Returns None for anything else."""
    match = _ARCHIVE_NO_RE.match(value.strip())
    if match is None:
        return None
    number = int(match.group(1))
    return number or None
