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


def test_trend_direction() -> None:
    assert stats.trend(60.0, 50.0) == "su"
    assert stats.trend(40.0, 50.0) == "giu"
    assert stats.trend(50.0, 50.0) == "stabile"


def test_trend_threshold_filters_noise() -> None:
    assert stats.trend(50.5, 50.0) == "stabile"
    assert stats.trend(51.5, 50.0) == "su"


def test_trend_missing_values() -> None:
    assert stats.trend(None, 50.0) is None
    assert stats.trend(50.0, None) is None


def test_in_season_plain_range() -> None:
    assert stats.in_season(4, 7, 5) is True
    assert stats.in_season(4, 7, 4) is True
    assert stats.in_season(4, 7, 7) is True
    assert stats.in_season(4, 7, 3) is False
    assert stats.in_season(4, 7, 8) is False


def test_in_season_wrapping_range() -> None:
    assert stats.in_season(12, 3, 12) is True
    assert stats.in_season(12, 3, 1) is True
    assert stats.in_season(12, 3, 3) is True
    assert stats.in_season(12, 3, 6) is False


def test_season_map_covers_every_family() -> None:
    for key in const.FAMILIES:
        assert key in const.POLLEN_SEASON
