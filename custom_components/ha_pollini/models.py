"""Dataclasses describing a parsed 3BMeteo pollen page.

Kept free of Home Assistant imports so the parser and the statistics can be
unit-tested in isolation.
"""

from __future__ import annotations

from dataclasses import dataclass, field


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
