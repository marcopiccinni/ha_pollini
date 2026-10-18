# Architettura

Documento di riferimento per chi mantiene l'integrazione. Riassume fonti dati,
struttura HTML parsata, invarianti e decisioni di design.

## Fonti dati

3BMeteo espone pagine web server-rendered (nessuna API pubblica documentata):

| Uso | URL |
| --- | --- |
| Pollini | `https://www.3bmeteo.com/meteo/<canonical>/pollini` |
| Ricerca località | `https://www.3bmeteo.com/search/search_localita/<query>` |

- `<canonical>` è lo slug del comune (es. `roma`, `roma+centro+storico`), ottenuto
  dalla ricerca come campo `canonical`.
- La ricerca restituisce JSON: `nome_loc`, `canonical`, `regione`, `stato`,
  `prov`, `id_localita`, `lat`, `lon`.
- **I pollini sono per provincia**: `/meteo/<comune>/pollini` risponde con 301
  verso la pagina della provincia (es. i comuni della provincia di Roma verso
  `/meteo/roma/pollini`). `aiohttp` segue il redirect; il canonical
  risolto viene estratto da `resp.url` (`client._resolved_canonical`).

## Struttura HTML parsata

La pagina ha **7 pannelli** (`div.content-day`, id `0`..`6`), uno per giorno,
con tab `Oggi`, `Domani`, `Sab 17`, … concordanti l'ordine dei pannelli.

Per ogni pannello, in ordine di documento:

- **famiglia**: `span.family-name` seguito da `div.tag tag-* ds-label-small`
  con il livello.
- **sottospecie**: `span.ds-body-medium` (`Nome:`) seguito da un `div.tag`.
  L'appartenenza alla famiglia si deduce cercando l'ultima famiglia che precede
  la sottospecie nel documento.

L'aggiornamento è in `Aggiornamento: <testo>`.

Il parser è in `parser.py::parse_pollen` e usa solo `re` + `html` (stdlib). La
logica pura è separata in moduli **senza import di Home Assistant** così da
essere testabile in isolamento: `models.py` (dataclass), `parser.py` (HTML),
`stats.py` (indice numerico). `client.py` contiene fetch, ricerca località,
redirect e cache.

## Normalizzazione famiglie

Il sito stampa i nomi con maiuscole variabili e a volte accoppiati
(`Chenopodiacee/amarantacee`). La mappa `FAMILIES` in `const.py` associa una
chiave stabile (slug) all'etichetta completa, e `family_key()` riduce
l'etichetta a chiave prendendo la parte prima di `/` in minuscolo.

## Invarianti

- **Una famiglia = un sensore.** Lo stato è il livello testuale
  (Assente/Basso/Medio/Alto), più leggibile di un numero.
- `unique_id` entità = `<canonical>_<family>`, più `<canonical>_index`,
  `<canonical>_riepilogo` e `<canonical>_indice_pct`.
- Il primo giorno parsato è sempre **oggi**: `PollenCoordinator.current_day`
  restituisce `days[0]`.
- Le famiglie non selezionate non vengono create; al cambio opzioni le entità
  orfane vengono rimosse dal registry (`sensor._remove_orphan_entities`).
- Nessuna dipendenza extra in `manifest.json` (parsing con stdlib).

## Indice numerico

`<canonical>_indice_pct` (`PollenValueSensor`) espone lo stesso stato di
`riepilogo`, ma come numero: la **media** dei livelli delle famiglie selezionate
mappata 0-100 (`stats.numeric_index`: Assente 0, Basso 33.3, Medio 66.7, Alto
100), con `state_class: measurement` per statistiche, storico e automazioni.

## Card

`www/ha-pollini-card.js` è servita dall'integrazione e caricata con
`frontend.add_extra_js_url` in `__init__.py::_async_register_card`. Definisce
l'elemento `ha-pollini-card` e lo espone nel card picker. Le opzioni sono gestite
da `setConfig` (con default robusti) e dall'editor `ha-pollini-card-editor`; le
azioni (`tap_action`, `hold_action`, `double_tap_action`) usano i selector
`ui_action` e la stessa semantica delle card native. Due palette colori
(`default`, `colorblind`) e tre varianti (`gauge`, `bar`, `bars`) sono definite
nel file: la card è vanilla JS, senza build. L'interfaccia è localizzata IT/EN
(`_t`/`_lvl` da `hass.locale.language`, override con `language`) e accessibile
(ruoli/`aria-label`, navigazione da tastiera dei giorni). La freccia di tendenza
legge l'attributo `trend` calcolato dai sensori confrontando l'indice corrente
con `coordinator.previous_data`. La stagionalità usa `const.POLLEN_SEASON`
(calendario approssimativo, con stagioni che possono scavalcare l'anno) e
`stats.in_season`.

## Flusso

```
config flow (search_localita) -> entry(canonical)
   -> PollenCoordinator (fetch /meteo/<canonical>/pollini, segue redirect, parse, cache TTL)
   -> sensor.py: 1 sensore/famiglia + indice + riepilogo + indice_pct (con `previsioni` per giorno)
   -> card JS legge attributi (livello, sottospecie, previsioni)
```
