# Changelog

Tutte le modifiche degne di nota di questo progetto.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il
progetto usa il [Versionamento Semantico](https://semver.org/lang/it/).

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
