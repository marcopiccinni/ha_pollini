"""Sensor platform for the 3BMeteo Pollen integration."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import (
    ATTRIBUTION,
    BASE_URL,
    CONF_FAMILIES,
    CONF_LOCATION,
    DEFAULT_FAMILIES,
    DOMAIN,
    FAMILIES,
    LEVELS,
    POLLEN_PATH,
)
from .coordinator import PollenCoordinator
from .stats import numeric_index


def _selected_keys(coordinator: PollenCoordinator) -> list[str]:
    return [
        key
        for key in coordinator.entry.options.get(CONF_FAMILIES, DEFAULT_FAMILIES)
        if key in FAMILIES
    ]


_IT_DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]


def _day_label(index: int) -> str:
    """Return a uniform 'Gio 16' style label for the day at ``index`` (0 = today)."""
    date = dt_util.now().date() + timedelta(days=index)
    return f"{_IT_DAYS[date.weekday()]} {date.day}"


def _level_index(level: str | None) -> int | None:
    return LEVELS.get(level or "", {}).get("index")


def _level_color(level: str | None) -> str | None:
    return LEVELS.get(level or "", {}).get("color")


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Create one sensor per selected family, plus an overall index."""
    coordinator: PollenCoordinator = entry.runtime_data
    keys = _selected_keys(coordinator)
    _remove_orphan_entities(hass, entry, coordinator.canonical, keys)
    entities: list[SensorEntity] = [
        PollenFamilySensor(coordinator, key) for key in keys
    ]
    entities.append(PollenIndexSensor(coordinator))
    entities.append(PollenSummarySensor(coordinator))
    entities.append(PollenValueSensor(coordinator))
    async_add_entities(entities)


def _remove_orphan_entities(
    hass: HomeAssistant,
    entry: ConfigEntry,
    canonical: str,
    keys: list[str],
) -> None:
    """Drop registry entries for families no longer exposed."""
    expected = {f"{canonical}_{key}" for key in keys}
    expected.add(f"{canonical}_index")
    expected.add(f"{canonical}_riepilogo")
    expected.add(f"{canonical}_indice_pct")
    registry = er.async_get(hass)
    for reg_entry in er.async_entries_for_config_entry(registry, entry.entry_id):
        if reg_entry.unique_id not in expected:
            registry.async_remove(reg_entry.entity_id)


class _PollenBaseSensor(SensorEntity):
    """Common attributes for the pollen sensors."""

    _attr_attribution = ATTRIBUTION
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, coordinator: PollenCoordinator) -> None:
        self.coordinator = coordinator
        self._location = coordinator.entry.data.get(
            CONF_LOCATION, coordinator.canonical
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )

    @property
    def device_info(self) -> dict[str, Any]:
        return {
            "identifiers": {(DOMAIN, self.coordinator.canonical)},
            "name": f"Pollini {self._location}",
            "manufacturer": "3BMeteo",
            "model": "Pollini",
            "configuration_url": BASE_URL
            + POLLEN_PATH.format(canonical=self.coordinator.canonical),
        }

    def _level_for(self, key: str, day_index: int = 0) -> str | None:
        return _family_level(self.coordinator, key, day_index)

    def _base_attributes(self) -> dict[str, Any]:
        attrs: dict[str, Any] = {"localita": self._location}
        if self.coordinator.data:
            attrs["provincia"] = self.coordinator.data.resolved
            attrs["aggiornamento"] = self.coordinator.data.updated
        return attrs


class PollenFamilySensor(_PollenBaseSensor):
    """Today's pollen level for a single family."""

    _attr_icon = "mdi:flower-pollen"

    def __init__(self, coordinator: PollenCoordinator, key: str) -> None:
        super().__init__(coordinator)
        self.key = key
        self._attr_name = FAMILIES[key]
        self._attr_unique_id = f"{coordinator.canonical}_{key}"

    @property
    def native_value(self) -> str | None:
        return self._level_for(self.key)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        level = self._level_for(self.key)
        attrs = self._base_attributes()
        attrs.update(
            {
                "famiglia": self.key,
                "nome": FAMILIES[self.key],
                "livello": level,
                "indice": _level_index(level),
                "colore": _level_color(level),
                "sottospecie": _serialize_subs(self.coordinator, self.key),
                "previsioni": _serialize_days(self.coordinator, self.key),
            }
        )
        return attrs


class PollenIndexSensor(_PollenBaseSensor):
    """Overall pollen: the worst level among the selected families."""

    _attr_name = "Indice"
    _attr_icon = "mdi:flower"

    def __init__(self, coordinator: PollenCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.canonical}_index"

    @property
    def native_value(self) -> str | None:
        return _worst_level(self.coordinator)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        level = _worst_level(self.coordinator)
        attrs = self._base_attributes()
        attrs.update(
            {
                "livello": level,
                "indice": _level_index(level),
                "colore": _level_color(level),
                "giorni": _worst_by_day(self.coordinator),
            }
        )
        return attrs


def _worst_level(coordinator: PollenCoordinator) -> str | None:
    """The worst level among the selected families for the current day."""
    worst: str | None = None
    worst_index = 0
    for key in _selected_keys(coordinator):
        index = _level_index(_family_level(coordinator, key)) or 0
        if index >= worst_index:
            worst_index = index
            worst = _family_level(coordinator, key)
    return worst


def _numeric_index(coordinator: PollenCoordinator) -> float | None:
    """Mean pollen level of the selected families on a 0-100 scale.

    Levels map to 0/33.3/66.7/100, so the value is easy to compare with the
    air-quality index and keeps Home Assistant's long-term statistics working.
    Only families with a known level contribute.
    """
    return numeric_index(
        _level_index(_family_level(coordinator, key))
        for key in _selected_keys(coordinator)
    )


def _family_level(
    coordinator: PollenCoordinator, key: str, day_index: int = 0
) -> str | None:
    if not coordinator.data or day_index >= len(coordinator.data.days):
        return None
    family = coordinator.data.days[day_index].families.get(key)
    return family.level if family else None


class PollenSummarySensor(_PollenBaseSensor):
    """Summary of the pollen risk: worst level plus the most severe families.

    The "present" families are the ones above *Assente*, ordered by severity,
    so the entity works as a generic pollen-risk indicator for dashboards,
    cards and automations.
    """

    _attr_name = "Riepilogo"
    _attr_icon = "mdi:flower-pollen-outline"

    def __init__(self, coordinator: PollenCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.canonical}_riepilogo"

    def _rows(self) -> list[dict[str, Any]]:
        return _day_rows(self.coordinator, 0)

    @property
    def native_value(self) -> str | None:
        return _worst_level(self.coordinator)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        level = _worst_level(self.coordinator)
        rows = self._rows()
        present = [row for row in rows if row["indice"] > 1]
        counts: dict[str, int] = {}
        for row in rows:
            name = row["livello"] or "—"
            counts[name] = counts.get(name, 0) + 1
        attrs = self._base_attributes()
        attrs.update(
            {
                "nome": "Riepilogo",
                "livello": level,
                "indice": _level_index(level),
                "colore": _level_color(level),
                "famiglie_piu_presenti": present,
                "conteggio_per_livello": counts,
                "totale_famiglie": len(rows),
                "famiglie_presenti": len(present),
                "famiglie": rows,
                "previsioni": _serialize_summary_days(self.coordinator),
                "giorni": _worst_by_day(self.coordinator),
            }
        )
        return attrs


def _day_rows(
    coordinator: PollenCoordinator, day_index: int
) -> list[dict[str, Any]]:
    """Selected families for one day, ordered by severity then name."""
    rows: list[dict[str, Any]] = []
    for key in _selected_keys(coordinator):
        level = _family_level(coordinator, key, day_index)
        index = _level_index(level) or 0
        rows.append(
            {
                "chiave": key,
                "nome": FAMILIES[key],
                "livello": level,
                "indice": index,
                "colore": _level_color(level),
            }
        )
    rows.sort(key=lambda row: (-row["indice"], row["nome"]))
    return rows


def _serialize_summary_days(coordinator: PollenCoordinator) -> list[dict[str, Any]]:
    """Per-day family breakdown for the summary, so the card is day-aware."""
    if not coordinator.data:
        return []
    result: list[dict[str, Any]] = []
    for day_index in range(len(coordinator.data.days)):
        rows = _day_rows(coordinator, day_index)
        worst: str | None = None
        worst_index = 0
        for row in rows:
            if row["indice"] > worst_index:
                worst_index = row["indice"]
                worst = row["livello"]
        result.append(
            {
                "giorno": _day_label(day_index),
                "livello": worst,
                "indice": worst_index or None,
                "colore": _level_color(worst),
                "famiglie": rows,
                "famiglie_piu_presenti": [
                    row for row in rows if row["indice"] > 1
                ],
            }
        )
    return result


def _serialize_subs(coordinator: PollenCoordinator, key: str) -> list[dict[str, Any]]:
    day = coordinator.current_day()
    family = day.families.get(key) if day else None
    if not family:
        return []
    return [
        {"nome": sub.name, "livello": sub.level, "indice": _level_index(sub.level)}
        for sub in family.subs
    ]


def _serialize_days(coordinator: PollenCoordinator, key: str) -> list[dict[str, Any]]:
    if not coordinator.data:
        return []
    result: list[dict[str, Any]] = []
    for index, day in enumerate(coordinator.data.days):
        family = day.families.get(key)
        level = family.level if family else None
        result.append(
            {
                "giorno": _day_label(index),
                "livello": level,
                "indice": _level_index(level),
                "sottospecie": [
                    {
                        "nome": sub.name,
                        "livello": sub.level,
                        "indice": _level_index(sub.level),
                    }
                    for sub in (family.subs if family else [])
                ],
            }
        )
    return result


def _worst_by_day(coordinator: PollenCoordinator) -> list[dict[str, Any]]:
    if not coordinator.data:
        return []
    keys = _selected_keys(coordinator)
    result: list[dict[str, Any]] = []
    for day_index, day in enumerate(coordinator.data.days):
        worst: str | None = None
        worst_index = 0
        for key in keys:
            family = day.families.get(key)
            index = _level_index(family.level if family else None) or 0
            if index >= worst_index:
                worst_index = index
                worst = family.level if family else None
        result.append(
            {
                "giorno": _day_label(day_index),
                "livello": worst,
                "indice": worst_index or None,
            }
        )
    return result


class PollenValueSensor(_PollenBaseSensor):
    """Overall pollen level as a number (0-100, 100 = highest level).

    Exposed with ``state_class: measurement`` so Home Assistant keeps
    long-term statistics: history graphs, statistics cards and numeric
    thresholds in automations. The worst-level text stays on the index and
    summary sensors, which keep their original behaviour.
    """

    _attr_name = "Indice numerico"
    _attr_icon = "mdi:gauge"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1

    def __init__(self, coordinator: PollenCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.canonical}_indice_pct"

    @property
    def native_value(self) -> float | None:
        return _numeric_index(self.coordinator)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        rows = _day_rows(self.coordinator, 0)
        worst = _worst_level(self.coordinator)
        counts: dict[str, int] = {}
        for row in rows:
            name = row["livello"] or "—"
            counts[name] = counts.get(name, 0) + 1
        attrs = self._base_attributes()
        attrs.update(
            {
                "scala": "Pollini 0-100",
                "livello": worst,
                "indice": _level_index(worst),
                "colore": _level_color(worst),
                "famiglie": rows,
                "conteggio_per_livello": counts,
                "totale_famiglie": len(rows),
            }
        )
        return attrs
