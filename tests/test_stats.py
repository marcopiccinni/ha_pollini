"""Unit tests for the pure pollen index statistics (no Home Assistant needed)."""

from __future__ import annotations

import pytest
from ha_pollini import const, stats


def test_level_to_value_maps_levels_to_0_100() -> None:
    assert stats.level_to_value(1) == 0.0
    assert stats.level_to_value(2) == pytest.approx(33.3)
    assert stats.level_to_value(3) == pytest.approx(66.7)
    assert stats.level_to_value(4) == 100.0
    assert stats.level_to_value(None) is None


def test_numeric_index_average_of_known_levels() -> None:
    assert stats.numeric_index([1, 4]) == 50.0
    assert stats.numeric_index([4, 4, 4]) == 100.0


def test_numeric_index_skips_unknown() -> None:
    assert stats.numeric_index([2, None, 2]) == pytest.approx(33.3)


def test_numeric_index_empty() -> None:
    assert stats.numeric_index([]) is None
    assert stats.numeric_index([None]) is None


def test_levels_map_to_site_indices() -> None:
    assert [const.LEVELS[name]["index"] for name in ("Assente", "Basso", "Medio", "Alto")] == [
        1,
        2,
        3,
        4,
    ]
