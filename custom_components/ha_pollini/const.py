"""Constants for the 3BMeteo Pollen integration."""

from __future__ import annotations

from datetime import timedelta
from typing import Final

DOMAIN: Final = "ha_pollini"
VERSION: Final = "0.1.3"

# 3BMeteo public web pages (scraped; see DISCLAIMER).
BASE_URL: Final = "https://www.3bmeteo.com"
POLLEN_PATH: Final = "/meteo/{canonical}/pollini"
SEARCH_PATH: Final = "/search/search_localita/{query}"
SITE_URL: Final = "https://www.3bmeteo.com/meteo/italia/pollini"

USER_AGENT: Final = (
    f"ha_pollini/{VERSION} (+https://github.com/marcopiccinni/ha_pollini)"
)

# Refresh interval in seconds. The bulletin changes a few times per day.
DEFAULT_SCAN_INTERVAL: Final = 3600
MIN_SCAN_INTERVAL: Final = 900
MAX_SCAN_INTERVAL: Final = 86400

# Short-lived cache shared by all locations (same host, be nice).
CACHE_TTL: Final = timedelta(seconds=120)

CONF_CANONICAL: Final = "canonical"
CONF_LOCATION: Final = "location"
CONF_PROVINCE: Final = "province"
CONF_FAMILIES: Final = "families"
CONF_SCAN_INTERVAL: Final = "scan_interval"

# Pollen family key (stable slug) -> display label shown on the site.
FAMILIES: Final[dict[str, str]] = {
    "aceracee": "Aceracee",
    "betulacee": "Betulacee",
    "chenopodiacee": "Chenopodiacee/Amarantacee",
    "composite": "Composite",
    "corilacee": "Corilacee",
    "cupressacee": "Cupressacee/Taxacee",
    "fagacee": "Fagacee",
    "graminacee": "Graminacee",
    "oleacee": "Oleacee",
    "pinacee": "Pinacee",
    "platanacee": "Platanacee",
    "poligonacee": "Poligonacee",
    "salicacee": "Salicacee",
    "ulmacee": "Ulmacee",
    "urticacee": "Urticacee",
}
DEFAULT_FAMILIES: Final = list(FAMILIES)

# The site prints family names sometimes with a "/" pair and lowercase the
# first letter; normalise the label back to a key.
FAMILY_LABEL_TO_KEY: Final[dict[str, str]] = {
    label.split("/")[0].strip().lower(): key for key, label in FAMILIES.items()
}


def family_key(label: str) -> str | None:
    """Map a site label (e.g. ``Chenopodiacee/amarantacee``) to a family key."""
    return FAMILY_LABEL_TO_KEY.get(label.split("/")[0].strip().lower())


# Pollen levels, best -> worst, with the colour used on the site.
LEVELS: Final[dict[str, dict[str, object]]] = {
    "Assente": {"index": 1, "color": "#2e7d32"},
    "Basso": {"index": 2, "color": "#f9a825"},
    "Medio": {"index": 3, "color": "#ef6c00"},
    "Alto": {"index": 4, "color": "#c62828"},
}

ATTRIBUTION: Final = "Dati: 3BMeteo (www.3bmeteo.com)"

DISCLAIMER: Final = (
    "Integrazione NON ufficiale, non affiliata a 3BMeteo. I dati sono letti "
    "dalle pagine pubbliche del sito e la loro disponibilita' non e' "
    "garantita. Uso soggetto ai termini di servizio di 3BMeteo."
)
