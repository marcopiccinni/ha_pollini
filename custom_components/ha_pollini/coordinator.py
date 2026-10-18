"""Data update coordinator for the 3BMeteo Pollen integration."""

from __future__ import annotations

import logging
from datetime import timedelta

import aiohttp
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .client import PollenClient, PollenDay, PollenReport
from .const import (
    CONF_CANONICAL,
    CONF_FAMILIES,
    CONF_SCAN_INTERVAL,
    DEFAULT_FAMILIES,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class PollenCoordinator(DataUpdateCoordinator[PollenReport]):
    """Coordinator exposing the pollen report of one location."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.canonical: str = str(entry.data[CONF_CANONICAL])
        self.client = PollenClient(hass)
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN} {self.canonical}",
            update_interval=timedelta(
                seconds=int(
                    entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
                )
            ),
            config_entry=entry,
        )
        self.entry = entry
        self.previous_data: PollenReport | None = None

    @property
    def families(self) -> list[str]:
        """Families selected by the user (ordered as configured)."""
        return list(self.entry.options.get(CONF_FAMILIES, DEFAULT_FAMILIES))

    async def _async_update_data(self) -> PollenReport:
        previous = self.data
        try:
            report = await self.client.async_get(self.canonical)
        except TimeoutError as err:
            raise UpdateFailed("Timeout fetching pollen page") from err
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Error fetching pollen page: {err}") from err
        except ValueError as err:
            raise UpdateFailed(f"Invalid pollen page: {err}") from err
        self.previous_data = previous
        return report

    def current_day(self) -> PollenDay | None:
        """Return today's forecast.

        3BMeteo always lists today first, so the first parsed day is today.
        """
        if not self.data or not self.data.days:
            return None
        return self.data.days[0]
