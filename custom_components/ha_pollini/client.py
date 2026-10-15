"""HTTP client and HTML parser for 3BMeteo pollen pages.

The pollen page (``/meteo/<canonical>/pollini``) is server-rendered and, since
pollen is forecast per province, any town URL redirects to the province page
(e.g. ``/meteo/modena/pollini``). The page lists seven days; for each day it
shows the pollen level ("Assente", "Basso", "Medio", "Alto") for fifteen
families, each with an optional list of sub-species.
"""

from __future__ import annotations

import asyncio
import html
import logging
import re
import time
from dataclasses import dataclass, field

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    BASE_URL,
    CACHE_TTL,
    POLLEN_PATH,
    SEARCH_PATH,
    USER_AGENT,
    family_key,
)

_LOGGER = logging.getLogger(__name__)

_UPDATED_RE = re.compile(r"Aggiornamento:\s*([^<]+)")
_TAB_RE = re.compile(
    r'<a href="#(\d+)"[^>]*class="tab[^"]*"[^>]*>\s*([^<]+?)\s*</a>'
)
_PANEL_RE = re.compile(r'id="(\d)" class="content-day[^"]*"')
_FAMILY_RE = re.compile(
    r'family-name[^>]*>([^<]+)</span>\s*'
    r'<div class="tag (tag-[a-z]+) ds-label-small">\s*([A-Za-zÀ-ÿ]+)'
)
_SUB_RE = re.compile(
    r'<span class="ds-body-medium">([^<]+?):\s*</span>\s*'
    r'<div class="tag (tag-[a-z]+) ds-label-small">\s*([A-Za-zÀ-ÿ]+)'
)


@dataclass(slots=True)
class PollenSub:
    """One sub-species level within a family."""

    name: str
    level: str


@dataclass(slots=True)
class PollenFamily:
    """Pollen level for one family on one day."""

    key: str
    label: str
    level: str
    subs: list[PollenSub] = field(default_factory=list)


@dataclass(slots=True)
class PollenDay:
    """One day of pollen forecast."""

    label: str | None
    families: dict[str, PollenFamily] = field(default_factory=dict)


@dataclass(slots=True)
class PollenReport:
    """Parsed pollen page for one location."""

    canonical: str
    resolved: str
    updated: str | None
    days: list[PollenDay]


def parse_pollen(html_text: str, canonical: str = "", resolved: str = "") -> PollenReport:
    """Parse the pollen HTML page into a :class:`PollenReport`."""
    updated_match = _UPDATED_RE.search(html_text)
    tabs = _TAB_RE.findall(html_text)
    panels = list(_PANEL_RE.finditer(html_text))
    days: list[PollenDay] = []

    for index, match in enumerate(panels):
        start = match.end()
        end = panels[index + 1].start() if index + 1 < len(panels) else start + 300_000
        segment = html_text[start:end]

        families: dict[str, PollenFamily] = {}
        positions: list[tuple[int, str]] = []
        for fam in _FAMILY_RE.finditer(segment):
            label = html.unescape(fam.group(1)).strip()
            key = family_key(label)
            if key is None:
                continue
            families[key] = PollenFamily(key=key, label=label, level=fam.group(3))
            positions.append((fam.start(), key))

        for sub in _SUB_RE.finditer(segment):
            owner: str | None = None
            for pos, key in positions:
                if pos < sub.start():
                    owner = key
                else:
                    break
            if owner is None:
                continue
            families[owner].subs.append(
                PollenSub(name=html.unescape(sub.group(1)).strip(), level=sub.group(3))
            )

        label = tabs[index][1].strip() if index < len(tabs) else None
        days.append(PollenDay(label=label, families=families))

    return PollenReport(
        canonical=canonical,
        resolved=resolved or canonical,
        updated=updated_match.group(1).strip() if updated_match else None,
        days=days,
    )


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
