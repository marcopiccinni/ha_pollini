"""HTTP client and HTML parser for 3BMeteo pollen pages.

The parsing itself lives in :mod:`.parser` (free of Home Assistant imports);
this module only performs the HTTP fetches, the location search and the
short-lived cache.
"""

from __future__ import annotations

import asyncio
import logging
import time

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    BASE_URL,
    CACHE_TTL,
    POLLEN_PATH,
    SEARCH_PATH,
    USER_AGENT,
)
from .models import PollenDay, PollenFamily, PollenReport, PollenSub
from .parser import parse_pollen

_LOGGER = logging.getLogger(__name__)

__all__ = [
    "PollenClient",
    "PollenDay",
    "PollenFamily",
    "PollenReport",
    "PollenSub",
    "parse_pollen",
]


async def async_search_locations(
    hass: HomeAssistant, query: str
) -> list[dict[str, object]]:
    """Search 3BMeteo for locations matching ``query``."""
    query = query.strip()
    if len(query) < 2:
        return []
    session = async_get_clientsession(hass)
    url = f"{BASE_URL}{SEARCH_PATH.format(query=_slugify(query))}"
    async with session.get(
        url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=20)
    ) as resp:
        resp.raise_for_status()
        data = await resp.json(content_type=None)
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict) and item.get("canonical")]


def _slugify(query: str) -> str:
    """Turn a free-text query into the path segment 3BMeteo expects."""
    return (
        query.strip().lower().replace(" ", "+").replace("'", "").replace("’", "")
    )


def _resolved_canonical(url: str) -> str:
    """Extract the ``<canonical>`` from ``/meteo/<canonical>/pollini``."""
    parts = [p for p in url.split("/") if p]
    try:
        idx = parts.index("meteo")
    except ValueError:
        return ""
    return parts[idx + 1] if idx + 1 < len(parts) else ""


class PollenClient:
    """Fetch and cache pollen pages."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._session = async_get_clientsession(hass)
        self._cache: dict[str, tuple[float, PollenReport]] = {}
        self._lock = asyncio.Lock()

    async def async_get(self, canonical: str) -> PollenReport:
        """Return the (cached) pollen report for ``canonical``."""
        async with self._lock:
            cached = self._cache.get(canonical)
            if cached and time.monotonic() - cached[0] < CACHE_TTL.total_seconds():
                return cached[1]

        url = f"{BASE_URL}{POLLEN_PATH.format(canonical=canonical)}"
        async with self._session.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            resp.raise_for_status()
            text = await resp.text()
            resolved = _resolved_canonical(str(resp.url))

        report = parse_pollen(text, canonical, resolved)
        if not report.days:
            raise ValueError(f"No pollen data parsed for {canonical!r}")

        async with self._lock:
            self._cache[canonical] = (time.monotonic(), report)
        return report
