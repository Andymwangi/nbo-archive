"""Resolve the real client address for throttling and audit fields.

The web app's Server Actions call this API on the visitor's behalf, so every such request
arrives from the web server. The web server forwards the visitor's address in
X-Forwarded-For; it is honoured only when the direct peer is a trusted proxy, otherwise
anyone could rotate the header to dodge rate limits.
"""

import ipaddress
from functools import lru_cache

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle


@lru_cache(maxsize=1)
def _trusted_networks(spec: tuple[str, ...]) -> tuple[ipaddress._BaseNetwork, ...]:
    return tuple(ipaddress.ip_network(entry, strict=False) for entry in spec)


def _parse_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def client_ip(request) -> str | None:
    remote = _parse_ip(request.META.get("REMOTE_ADDR", ""))
    if remote is None:
        return None
    networks = _trusted_networks(tuple(settings.TRUSTED_PROXIES))
    if not any(ipaddress.ip_address(remote) in network for network in networks):
        return remote
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    # The trusted proxy appends the address it saw, so the last entry is the one it vouches for.
    candidate = _parse_ip(forwarded.split(",")[-1]) if forwarded else None
    return candidate or remote


class ClientAnonRateThrottle(AnonRateThrottle):
    def get_ident(self, request):
        return client_ip(request) or super().get_ident(request)


class ClientScopedRateThrottle(ScopedRateThrottle):
    def get_ident(self, request):
        return client_ip(request) or super().get_ident(request)
