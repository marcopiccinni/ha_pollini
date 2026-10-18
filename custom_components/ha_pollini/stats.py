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
