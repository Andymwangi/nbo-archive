import pytest
from django.core.exceptions import ValidationError

from apps.common.phone import normalise_kenyan_phone


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0712345678", "+254712345678"),
        ("0712 345 678", "+254712345678"),
        ("0112-345-678", "+254112345678"),
        ("254712345678", "+254712345678"),
        ("+254 712 345 678", "+254712345678"),
        ("712345678", "+254712345678"),
        ("(0712) 345678", "+254712345678"),
    ],
)
def test_normalises_kenyan_mobiles(raw, expected):
    assert normalise_kenyan_phone(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["", "0212345678", "07123456", "07123456789", "+255712345678", "+2540712345678", "phone"],
)
def test_rejects_non_kenyan_or_malformed(raw):
    with pytest.raises(ValidationError):
        normalise_kenyan_phone(raw)
