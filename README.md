# 3BMeteo Pollini per Home Assistant

Integrazione custom (HACS) che porta in Home Assistant le **previsioni dei
pollini** di una località italiana, lette dalle pagine pubbliche di
[3BMeteo](https://www.3bmeteo.com/meteo/italia/pollini), più una **card
Lovelace** dedicata con livello attuale, sottospecie e previsioni a 7 giorni.

- Dominio: `ha_pollini`
- Piattaforma: `sensor`
- Una voce di configurazione **per ogni comune**; puoi aggiungerne quanti vuoi.
- Per ogni comune scegli **quali famiglie** esporre (Aceracee, Betulacee,
  Composite, Graminacee, …).

> **Nota** — Le previsioni dei pollini di 3BMeteo sono **a livello
> provinciale**: tutti i comuni di una stessa provincia mostrano gli stessi
> dati. L'integrazione segue automaticamente il reindirizzamento alla pagina
> della provincia.

> **Disclaimer** — Progetto personale **NON ufficiale**, non affiliato a
> 3BMeteo. I dati sono estratti dalle pagine web pubbliche e la disponibilità
> non è garantita. L'uso è soggetto ai termini di servizio di 3BMeteo.

## Cosa crea

Per ogni comune configurato:

| Entità | Descrizione |
| --- | --- |
| `sensor.<localita>_<famiglia>` | Livello di polline di una famiglia (Assente/Basso/Medio/Alto) |
| `sensor.<localita>_indice` | Livello peggiore tra le famiglie selezionate |
| `sensor.<localita>_riepilogo` | Riepilogo: livello peggiore + famiglie più presenti |

Esempio di famiglie: `sensor.pollini_roma_composite`,
`sensor.pollini_roma_graminacee`, `sensor.pollini_roma_urticacee`. Gli id
reali dipendono dal nome che assegni al dispositivo; le famiglie non
selezionate nelle opzioni non vengono create.

### Attributi delle entità famiglia

- `livello` — Assente / Basso / Medio / Alto
- `indice` — 1…4, `colore` — colore del livello
- `nome` — nome esteso (es. `Cupressacee/Taxacee`), `famiglia` — chiave
- `sottospecie` — elenco delle specie con il relativo livello
- `previsioni` — i 7 giorni con livello, indice e sottospecie
- `provincia` — provincia risolta, `aggiornamento` — timestamp del bollettino

### Attributi dell'entità riepilogo

- `livello`, `indice`, `colore` — riepilogo complessivo (peggiore delle famiglie)
- `famiglie_piu_presenti` — famiglie oltre il livello "Assente", ordinate per
  severità
- `famiglie` — tutte le famiglie selezionate, ordinate per severità
- `conteggio_per_livello`, `famiglie_presenti`, `totale_famiglie`, `giorni`

## Installazione

### HACS (consigliata)

1. HACS → tre puntini → **Repository personalizzati**.
2. Aggiungi `https://github.com/marcopiccinni/ha_pollini` come categoria
   **Integration**.
3. Installa **3BMeteo Pollini** e riavvia Home Assistant.
4. **Impostazioni → Dispositivi e servizi → Aggiungi integrazione** →
   cerca *3BMeteo Pollini*.

### Manuale

Copia `custom_components/ha_pollini` nella cartella `custom_components/` della
tua configurazione e riavvia.

## Configurazione

1. Cerca il **nome del comune** (es. `Roma`).
2. Scegli il comune esatto tra i risultati.
3. (Facoltativo) **Configura** la voce per scegliere le famiglie e
   l'intervallo di aggiornamento (default 1 ora).

## Card Lovelace

L'integrazione include e registra automaticamente la card `ha-pollini-card`
(non serve installare nulla dal frontend). La card si configura anche
dall'**editor visuale** (entità principale, titolo, famiglie aggiuntive,
sottospecie e previsioni).

Esempio minimo (una sola famiglia o l'indice):

```yaml
type: custom:ha-pollini-card
title: Pollini — Roma
entity: sensor.pollini_roma_composite
```

Facoltativamente puoi aggiungere altre famiglie, mostrate come riepilogo in
fondo alla card:

```yaml
type: custom:ha-pollini-card
title: Pollini — Roma
entity: sensor.pollini_roma_composite
entities:
  - sensor.pollini_roma_graminacee
  - sensor.pollini_roma_urticacee
  - sensor.pollini_roma_oleacee
```

`entity` è la famiglia (o l'indice) mostrata in evidenza; `entities` (facoltativo)
sono famiglie aggiuntive mostrate in elenco. Sostituisci gli id con quelli
presenti nella tua istanza.

Nella striscia delle previsioni ogni giornata è **cliccabile**: selezionandola, il
badge in evidenza e le sottospecie si aggiornano a quella data (la giornata scelta
è evidenziata; di default è "oggi"). Cliccando il badge si apre la finestra con lo
**storico** dell'entità.

### Opzioni della card

| Opzione | Default | Descrizione |
| --- | --- | --- |
| `title` | nome entità | Titolo della card |
| `entity` | — | Famiglia (o indice) mostrata in evidenza |
| `entities` | — | Famiglie aggiuntive mostrate come righe |
| `show_subs` | `true` | Mostra le sottospecie della famiglia selezionata |
| `show_forecast` | `true` | Mostra la striscia dei giorni |

Per disattivare un'opzione impostala a `false`, ad esempio:

```yaml
type: custom:ha-pollini-card
title: Pollini — Roma
entity: sensor.pollini_roma_composite
show_forecast: false
```

Se l'entità principale è il riepilogo (`sensor.<localita>_riepilogo`), la card
mostra anche la sezione **"Pollini più presenti"** con le famiglie oltre il
livello "Assente".

### Alternativa con le card built-in

```yaml
type: vertical-stack
cards:
  - type: gauge
    entity: sensor.pollini_roma_indice
    name: Indice
    min: 1
    max: 4
    needle: true
    severity:
      green: 1
      yellow: 2
      orange: 3
      red: 4
  - type: entities
    title: Famiglie (oggi)
    entities:
      - sensor.pollini_roma_composite
      - sensor.pollini_roma_graminacee
      - sensor.pollini_roma_urticacee
      - sensor.pollini_roma_oleacee
```

## Livelli

| Livello | Indice | Colore |
| --- | --- | --- |
| Assente | 1 | verde `#2e7d32` |
| Basso | 2 | giallo `#f9a825` |
| Medio | 3 | arancione `#ef6c00` |
| Alto | 4 | rosso `#c62828` |

## Famiglie disponibili

Aceracee, Betulacee, Chenopodiacee/Amarantacee, Composite, Corilacee,
Cupressacee/Taxacee, Fagacee, Graminacee, Oleacee, Pinacee, Platanacee,
Poligonacee, Salicacee, Ulmacee, Urticacee.

## Note

- Dati e disponibilità dipendono interamente da 3BMeteo.
- Progetto personale, **manutenzione e supporto non garantiti**.
- Marchi e nomi citati appartengono ai rispettivi proprietari.

## Licenza

[MIT](LICENSE)
