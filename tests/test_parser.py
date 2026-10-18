"""Parser tests using small synthetic HTML snippets (no real site data)."""

from __future__ import annotations

from ha_pollini.parser import parse_pollen


def _family(name: str, level: str) -> str:
    return (
        f'<span class="family-name">{name}</span>'
        f'<div class="tag tag-green ds-label-small"> {level}</div>'
    )


def _sub(name: str, level: str) -> str:
    return (
        f'<span class="ds-body-medium">{name}: </span>'
        f'<div class="tag tag-red ds-label-small"> {level}</div>'
    )


def _page(days: list[tuple[str, str]]) -> str:
    tabs = "".join(
        f'<a href="#{index}" class="tab">{label}</a>'
        for index, (label, _) in enumerate(days)
    )
    panels = "".join(
        f'<div id="{index}" class="content-day">' + body + "</div>"
        for index, (_, body) in enumerate(days)
    )
    header = "<p>Aggiornamento: 16 ottobre alle ore 12:11</p>"
    return "<html><body>" + header + tabs + panels + "</body></html>"


def test_parse_pollen_extracts_families_and_subs() -> None:
    day_one = (
        _family("Graminacee", "Alto")
        + _sub("Gramigna", "Medio")
        + _family("Composite", "Basso")
        + _family("Chenopodiacee/amarantacee", "Assente")
    )
    day_two = _family("Graminacee", "Medio")
    html = _page([("Lun", day_one), ("Mar", day_two)])

    report = parse_pollen(html, "roma", "roma")

    assert report.canonical == "roma"
    assert report.resolved == "roma"
    assert report.updated == "16 ottobre alle ore 12:11"
    assert len(report.days) == 2

    first = report.days[0]
    assert first.label == "Lun"
    assert first.families["graminacee"].level == "Alto"
    assert first.families["graminacee"].subs[0].name == "Gramigna"
    assert first.families["graminacee"].subs[0].level == "Medio"
    assert first.families["composite"].level == "Basso"
    assert first.families["chenopodiacee"].level == "Assente"
    assert report.days[1].families["graminacee"].level == "Medio"


def test_parse_pollen_defaults_resolved_to_canonical() -> None:
    report = parse_pollen(_page([("Lun", _family("Graminacee", "Basso"))]), "roma")
    assert report.resolved == "roma"


def test_parse_pollen_empty_html() -> None:
    report = parse_pollen("", "roma")
    assert report.days == []
    assert report.updated is None
