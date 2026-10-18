"""HTML parser for the 3BMeteo pollen page (no Home Assistant imports).

The pollen page (``/meteo/<canonical>/pollini``) is server-rendered and, since
pollen is forecast per province, any town URL redirects to the province page
(e.g. ``/meteo/roma/pollini``). The page lists seven days; for each day it
shows the pollen level ("Assente", "Basso", "Medio", "Alto") for fifteen
families, each with an optional list of sub-species.
"""

from __future__ import annotations

import html
import re

from .const import family_key
from .models import PollenDay, PollenFamily, PollenReport, PollenSub

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


def parse_pollen(
    html_text: str, canonical: str = "", resolved: str = ""
) -> PollenReport:
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
