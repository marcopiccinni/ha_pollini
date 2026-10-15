# Changelog

Tutte le modifiche degne di nota di questo progetto.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il
progetto usa il [Versionamento Semantico](https://semver.org/lang/it/).

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
