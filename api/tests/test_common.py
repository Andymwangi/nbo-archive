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


class TestClientIp:
    @staticmethod
    def _request(remote, forwarded=None):
        from django.test import RequestFactory

        extra = {"REMOTE_ADDR": remote}
        if forwarded is not None:
            extra["HTTP_X_FORWARDED_FOR"] = forwarded
        return RequestFactory().get("/", **extra)

    def test_untrusted_peer_cannot_claim_another_address(self):
        from apps.common.client_ip import client_ip

        assert client_ip(self._request("203.0.113.9", "198.51.100.7")) == "203.0.113.9"

    def test_trusted_peer_forwards_last_entry(self):
        from apps.common.client_ip import client_ip

        request = self._request("127.0.0.1", "10.0.0.1, 198.51.100.7")
        assert client_ip(request) == "198.51.100.7"

    def test_trusted_peer_with_garbage_header_falls_back_to_peer(self):
        from apps.common.client_ip import client_ip

        assert client_ip(self._request("127.0.0.1", "not-an-ip")) == "127.0.0.1"

    def test_trusted_ipv6_loopback(self):
        from apps.common.client_ip import client_ip

        assert client_ip(self._request("::1", "2001:db8::5")) == "2001:db8::5"
