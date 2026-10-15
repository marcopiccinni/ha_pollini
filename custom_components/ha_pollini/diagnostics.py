"""Diagnostics support for the 3BMeteo Pollen integration."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_CANONICAL, CONF_LOCATION, CONF_PROVINCE


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    coordinator = entry.runtime_data
    data = coordinator.data
    return {
        "entry": {
            "canonical": entry.data.get(CONF_CANONICAL),
            "location": entry.data.get(CONF_LOCATION),
            "province": entry.data.get(CONF_PROVINCE),
        },
        "options": dict(entry.options),
        "resolved": data.resolved if data else None,
        "updated": data.updated if data else None,
        "days": [
            {
                "day": day.label,
                "families": {
                    key: {
                        "level": family.level,
                        "subs": [
                            {"name": sub.name, "level": sub.level}
                            for sub in family.subs
                        ],
                    }
                    for key, family in day.families.items()
                },
            }
            for day in (data.days if data else [])
        ],
    }
