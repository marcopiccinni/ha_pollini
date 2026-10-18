# Changelog

Tutte le modifiche degne di nota di questo progetto.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il
progetto usa il [Versionamento Semantico](https://semver.org/lang/it/).

## [0.3.0] - 2026-10-18

### Aggiunto

- **Card localizzata (IT/EN)**: le etichette dell'interfaccia seguono la lingua
  di Home Assistant, con override tramite la nuova opzione `language`
  (`auto`/`it`/`en`). Sono tradotti anche i livelli e i testi relativi
  ("Agg.", "Non disponibile", ecc.).
- **Nuova variante `bars`** per la card: una riga per ogni famiglia con barra,
  nome e livello; ogni riga apre lo storico del sensore.
- **Stagionalità**: i sensori famiglia espongono `in_stagione` (se la famiglia è
  tipicamente in fioritura nel mese corrente) e la card mostra un'indicazione
  "In stagione". Calendario approssimativo in `const.POLLEN_SEASON`.
- **Tendenza** (`trend`) sugli attributi di `Riepilogo` e `Indice numerico`:
  `su`/`giu`/`stabile` confrontando l'indice con l'aggiornamento precedente; la
  card mostra una freccia accanto al valore.
- **Accessibilità**: badge/barra/righe e giorni delle previsioni hanno
  `role`/`aria-label`, i giorni sono navigabili da tastiera (frecce + Invio) e
  compare un contorno `:focus-visible`.

## [0.2.0] - 2026-10-18

### Aggiunto

- Nuovo sensore numerico **Indice numerico** (`<canonical>_indice_pct`): livello
  medio delle famiglie selezionate mappato su una scala 0-100, con
  `state_class: measurement`. Abilita statistiche a lungo termine, grafici di
  storico e soglie numeriche nelle automazioni. L'`Indice` e il `Riepilogo`
  restano invariati.
- Test suite `pytest` (parser e indice numerico) con HTML sintetico; nuovo job
  CI **Tests** (lint + `pytest`).

### Modificato

- Refactoring interno: la logica pura è stata spostata in moduli senza
  dipendenze da Home Assistant (`models.py`, `parser.py`, `stats.py`) così da
  poter essere testata in isolamento.

## [0.1.7] - 2026-10-17

### Aggiunto

- Azioni configurabili sulla card, come le card native di Home Assistant:
  `tap_action`, `hold_action` e `double_tap_action`. Azioni supportate:
  `more-info`, `navigate`, `url`, `toggle`, `perform-action` (`call-service`) e
  `none`. Il riquadro dello stato resta sempre collegato allo storico e i
  giorni delle previsioni continuano a selezionare la giornata.
- Nuove opzioni della card: `variant` (`gauge`/`bar`) per scegliere tra badge e
  barra lineare, `color_scheme` (`default`/`colorblind`) per una palette sicura
  per i daltonici, `show_title` per nascondere l'intestazione, `compact` per un
  layout più denso e `relative_time` per l'ultimo aggiornamento in forma
  relativa ("5 min fa").

### Modificato

- L'ultimo aggiornamento è mostrato in forma relativa per impostazione
  predefinita (`relative_time` attivo); disattivandolo resta il formato
  compatto `gg/mm hh:mm`.
- Quando l'entità è `unavailable`/`unknown` la card mostra "Non disponibile"
  invece di valori vuoti.

## [0.1.6] - 2026-10-16

### Aggiunto

- Nuove opzioni della card: `forecast_days` (quante giornate mostrare nella
  striscia delle previsioni), `show_badge_name` (mostra/nascondi il nome della
  famiglia nel riquadro dello stato, default attivo) e `font_size`
  (`small`/`normal`/`large`/`xlarge`) per ingrandire o ridurre il testo senza
  toccare titolo, ultimo aggiornamento e stato principale.

### Modificato

- L'ultimo aggiornamento è mostrato in un formato compatto (`gg/mm hh:mm`).

## [0.1.5] - 2026-10-16

### Corretto

- Nel riepilogo, selezionando un giorno di previsione non si aggiornavano le
  famiglie e i relativi livelli. Ora `previsioni` del riepilogo contiene le
  famiglie (`famiglie`, `famiglie_piu_presenti`) per ogni giorno e la card
  aggiorna l'elenco "Pollini più presenti" in base al giorno selezionato.

## [0.1.4] - 2026-10-16

### Aggiunto

- Nuovo sensore `sensor.<provincia>_riepilogo`: lo stato è il livello peggiore
  del giorno; gli attributi includono `famiglie` (tutte le famiglie selezionate
  ordinate per severità), `famiglie_piu_presenti` (escluse quelle "Assenti"),
  `conteggio_per_livello`, `famiglie_presenti`, `totale_famiglie` e `giorni`.
- Nuova opzione della card `show_forecast` per nascondere la striscia dei
  giorni.
- La card mostra la sezione "Pollini più presenti" (famiglia e livello) quando
  l'entità è il riepilogo.

### Modificato

- Le opzioni booleane della card (`show_subs`, `show_forecast`) accettano ora
  esplicitamente `false`: prima un valore `false` esplicito veniva sovrascritto
  dal default.

## [0.1.3] - 2026-10-16

### Aggiunto

- L'editor visuale della card permette di scegliere entità principale, titolo,
  famiglie aggiuntive e l'opzione per mostrare le sottospecie.
- Nella striscia delle previsioni si può cliccare una giornata per aggiornare
  il badge e le sottospecie a quella data (la giornata selezionata è
  evidenziata; di default resta "oggi").
- Cliccando il badge si apre la finestra con lo storico dell'entità.

### Modificato

- Rimosso il promemoria dei colori (i quattro pallini) sotto il badge.
- Le etichette dei giorni nella striscia delle previsioni sono ora uniformi
  ("Ven 16", "Sab 17", …) anche per oggi e domani.
- Ogni voce di previsione espone ora le sottospecie del relativo giorno.

## [0.1.2] - 2026-10-16

### Aggiunto

- Editor visuale della card: selezione dell'entità principale, titolo,
  famiglie aggiuntive e opzione per mostrare le sottospecie. La card si
  configura ora anche dall'interfaccia, incluse più famiglie.

### Modificato

- Rimosso il promemoria dei colori (i quattro pallini) sotto il badge.

## [0.1.1] - 2026-10-16

### Corretto

- La card `ha-pollini-card` non compariva più nel selettore schede e non si
  renderizzava (spinner infinito, senza titolo, click inattivo). Home Assistant
  sostituisce `window.customElements` con un registry "scoped" durante l'avvio,
  dopo che il modulo della card (caricato tramite `frontend.add_extra_js_url`)
  aveva già registrato l'elemento sul registry precedente. Ora l'elemento viene
  ri-registrato sul registry definitivo appena viene rilevata la sostituzione.
- `getStubConfig` seleziona ora un sensore specifico dell'integrazione tramite
  l'attributo `famiglia`, evitando di agganciare entità di altre integrazioni.

## [0.1.0] - 2026-10-15

### Aggiunto

- Integrazione `ha_pollini`: previsioni dei pollini per località da 3BMeteo.
- Config flow con ricerca località e selezione del comune; risoluzione
  automatica del redirect provinciale.
- Opzioni: scelta delle famiglie e intervallo di aggiornamento.
- Sensori per famiglia di pollini (15 famiglie) + indice complessivo.
- Attributi con livello, indice, colore, sottospecie e previsioni a 7 giorni.
- Card Lovelace `ha-pollini-card` (badge livello + sottospecie + previsioni),
  inclusa e registrata automaticamente.
