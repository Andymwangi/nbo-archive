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


@pytest.mark.django_db
class TestInternalToken:
    """The web server's shared token lifts the anonymous rate limit and nothing else."""

    @pytest.fixture(autouse=True)
    def _tight_anon_limit(self, monkeypatch, settings):
        from apps.common.client_ip import ClientAnonRateThrottle

        settings.INTERNAL_API_TOKEN = "s3cret-token"
        monkeypatch.setattr(ClientAnonRateThrottle, "THROTTLE_RATES", {"anon": "2/min"})

    @staticmethod
    def _statuses(client, count, **headers):
        return [client.get("/api/v1/catalog/drops/", **headers).status_code for _ in range(count)]

    def test_anonymous_callers_are_limited(self, api_client):
        assert self._statuses(api_client, 3) == [200, 200, 429]

    def test_matching_token_skips_the_anonymous_limit(self, api_client):
        assert self._statuses(api_client, 5, HTTP_X_INTERNAL_TOKEN="s3cret-token") == [200] * 5

    def test_wrong_token_is_limited(self, api_client):
        assert self._statuses(api_client, 3, HTTP_X_INTERNAL_TOKEN="guess") == [200, 200, 429]

    def test_empty_setting_disables_the_bypass(self, api_client, settings):
        settings.INTERNAL_API_TOKEN = ""
        assert self._statuses(api_client, 3, HTTP_X_INTERNAL_TOKEN="") == [200, 200, 429]
