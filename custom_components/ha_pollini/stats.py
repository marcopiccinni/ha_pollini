"""Pure statistics for the pollen index (no Home Assistant imports)."""

from __future__ import annotations

from collections.abc import Iterable

# The site's pollen levels map to 1..4 (see ``const.LEVELS``).
LEVEL_MIN_INDEX = 1
LEVEL_MAX_INDEX = 4


def level_to_value(index: int | None) -> float | None:
    """Map a 1-4 level index onto a 0-100 scale (100 = highest level)."""
    if index is None:
        return None
    span = LEVEL_MAX_INDEX - LEVEL_MIN_INDEX
    return round((index - LEVEL_MIN_INDEX) / span * 100, 1)


def numeric_index(indices: Iterable[int | None]) -> float | None:
    """Average pollen level of the known levels, on a 0-100 scale."""
    values = [value for value in map(level_to_value, indices) if value is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def in_season(start: int, end: int, month: int) -> bool:
    """Whether ``month`` (1-12) falls inside the ``start``-``end`` season.

    Handles seasons that wrap across the new year (``start > end``), e.g.
    December-March. Accepts 1-12 for both bounds and the month.
    """
    if start <= end:
        return start <= month <= end
    return month >= start or month <= end


def trend(
    current: float | None, previous: float | None, threshold: float = 1.0
) -> str | None:
    """Return ``su``/``giu``/``stabile`` comparing two index values.

    ``threshold`` (0-100 points) filters out noise. Returns ``None`` when
    either value is missing (e.g. the first refresh after a restart).
    """
    if current is None or previous is None:
        return None
    if current > previous + threshold:
        return "su"
    if current < previous - threshold:
        return "giu"
    return "stabile"
