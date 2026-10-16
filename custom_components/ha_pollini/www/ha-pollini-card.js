/*
 * ha-pollini-card
 * Lovelace card for the "3BMeteo Pollini" integration (ha_pollini).
 *
 * Shows the current level of a pollen family (or the overall index) with a
 * coloured badge, the sub-species breakdown and a 7-day forecast strip, using
 * the attributes exposed by the integration.
 *
 * No build step: plain custom element, auto-registered by the integration.
 */

const LEVEL_COLORS = {
  Assente: "#2e7d32",
  Basso: "#f9a825",
  Medio: "#ef6c00",
  Alto: "#c62828",
};

const FONT_SCALES = {
  small: 0.85,
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

const IT_MONTHS = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

const CARD_VERSION = "0.1.6";

class HaPolliniCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._selectedDay = 0;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("È richiesto 'entity' (un sensore ha_pollini).");
    }
    this._config = { ...config };
    // Defaults: only an explicit `false` hides a block; unset stays visible.
    this._config.show_subs = this._config.show_subs !== false;
    this._config.show_forecast = this._config.show_forecast !== false;
    this._config.show_badge_name = this._config.show_badge_name !== false;
    this._config.font_size = this._config.font_size || "normal";
    this._selectedDay = 0;
    if (this._hass) this._render();
  }

  _scale() {
    return FONT_SCALES[this._config.font_size] || 1;
  }

  _limitForecast(forecast) {
    const n = Number(this._config.forecast_days);
    if (!this._config.forecast_days || Number.isNaN(n) || n <= 0) return forecast;
    return forecast.slice(0, n);
  }

  _onClick(ev) {
    const dayEl = ev.target.closest ? ev.target.closest("[data-day]") : null;
    if (dayEl) {
      const day = Number(dayEl.dataset.day);
      if (!Number.isNaN(day)) {
        this._selectedDay = day;
        this._render();
      }
      return;
    }
    const infoEl = ev.target.closest ? ev.target.closest("[data-more-info]") : null;
    if (infoEl && this._config && this._config.entity) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: this._config.entity },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass.states).find(
      (e) => e.startsWith("sensor.") && hass.states[e].attributes.famiglia !== undefined
    );
    return { entity: entity || "sensor.pollini_esempio_composite" };
  }

  static getConfigElement() {
    return document.createElement("ha-pollini-card-editor");
  }

  _state(entityId) {
    return this._hass && this._hass.states[entityId];
  }

  _render() {
    if (!this._config || !this._hass) return;
    const stateObj = this._state(this._config.entity);
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">Entità non trovata: ${this._config.entity}</div></ha-card>`;
      return;
    }
    const attrs = stateObj.attributes;
    const title =
      this._config.title || attrs.friendly_name || stateObj.entity_id;
    const name = attrs.nome || attrs.famiglia || "";
    const isSummary = !!attrs.famiglie_piu_presenti;
    const forecast = this._limitForecast(attrs.previsioni || attrs.giorni || []);
    const selected = forecast.length
      ? Math.min(this._selectedDay, forecast.length - 1)
      : 0;
    const day = forecast[selected] || null;
    const level =
      selected === 0
        ? attrs.livello || stateObj.state || ""
        : day
          ? day.livello || ""
          : "";
    const subs = day ? day.sottospecie || [] : attrs.sottospecie || [];
    const summaryList =
      selected > 0 && day
        ? day.famiglie_piu_presenti || []
        : attrs.famiglie_piu_presenti || [];
    const extras = (this._config.entities || [])
      .map((id) => this._state(id))
      .filter(Boolean);

    this.shadowRoot.innerHTML = `
      <style>${HaPolliniCard._css()}</style>
      <ha-card>
        <div class="content" style="font-size:${this._scale()}em">
          <div class="header">
            <span class="title">${title}</span>
            <span class="updated">${
              attrs.aggiornamento
                ? "Agg. " + _fmtAggiornamento(attrs.aggiornamento)
                : attrs.provincia || ""
            }</span>
          </div>
          ${this._badge(level, name)}
          ${
            isSummary
              ? this._summaryList(summaryList)
              : ""
          }
          ${this._config.show_subs && subs.length ? this._subs(subs) : ""}
          ${
            this._config.show_forecast
              ? this._forecast(forecast, selected)
              : ""
          }
          ${extras.length ? this._extras(extras) : ""}
        </div>
      </ha-card>`;
  }

  _summaryList(list) {
    if (!list.length) return "";
    const items = list
      .map((row) => {
        const color = LEVEL_COLORS[row.livello] || "#999";
        return `<div class="sum-row">
            <span class="s-name">${row.nome || row.chiave || ""}</span>
            <span class="s-lvl" style="color:${color}">${row.livello || ""}</span>
          </div>`;
      })
      .join("");
    return `<div class="summary"><div class="sum-title">Pollini più presenti</div>${items}</div>`;
  }

  _badge(level, name) {
    const color = LEVEL_COLORS[level] || "#999";
    const label = this._config.show_badge_name
      ? `<span class="bl-name">${name}</span>`
      : "";
    return `
      <div class="badge">
        <div class="badge-level" style="background:${color}" data-more-info="1" title="Mostra lo storico">
          ${label}
          <span class="bl-value">${level || "—"}</span>
        </div>
      </div>`;
  }

  _subs(subs) {
    const items = subs
      .map((s) => {
        const color = LEVEL_COLORS[s.livello] || "#999";
        return `<div class="sub">
            <span class="s-name">${s.nome}</span>
            <span class="s-level" style="color:${color}">${s.livello || ""}</span>
          </div>`;
      })
      .join("");
    return `<div class="subs">${items}</div>`;
  }

  _forecast(forecast, selected = 0) {
    if (!forecast.length) return "";
    const items = forecast
      .map((d, i) => {
        const color = LEVEL_COLORS[d.livello] || "#999";
        const sel = i === selected ? " selected" : "";
        return `<div class="day${sel}" data-day="${i}">
            <span class="d-name">${d.giorno || ""}</span>
            <span class="d-dot" style="background:${color}"></span>
            <span class="d-level" style="color:${color}">${d.livello || ""}</span>
          </div>`;
      })
      .join("");
    return `<div class="forecast">${items}</div>`;
  }

  _extras(list) {
    const items = list
      .map((s) => {
        const attrs = s.attributes;
        const name = attrs.nome || attrs.famiglia || attrs.friendly_name || s.entity_id;
        const level = attrs.livello || s.state || "";
        const color = LEVEL_COLORS[level] || "#999";
        return `<div class="extra">
            <span class="e-dot" style="background:${color}"></span>
            <span class="e-name">${name}</span>
            <span class="e-level" style="color:${color}">${level}</span>
          </div>`;
      })
      .join("");
    return `<div class="extras">${items}</div>`;
  }

  static _css() {
    return `
      ha-card { overflow: hidden; }
      .content { padding: 16px; }
      .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; gap: 8px; }
      .title { font-size: 1.1rem; font-weight: 600; color: var(--primary-text-color); }
      .updated { font-size: .8rem; color: var(--secondary-text-color); text-align: right; }
      .badge { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .badge-level { display: flex; flex-direction: column; align-items: center; border-radius: 12px; padding: 12px 28px; color: #fff; min-width: 50%; cursor: pointer; }
      .bl-name { font-size: .8rem; opacity: .9; }
      .bl-value { font-size: 1.6rem; font-weight: 700; }
      .subs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .sub { display: flex; gap: 6px; align-items: baseline; font-size: .85em; background: var(--secondary-background-color, #f4f4f4); border-radius: 8px; padding: 3px 8px; }
      .s-name { color: var(--primary-text-color); }
      .s-level { font-weight: 600; }
      .summary { margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 8px; }
      .sum-title { font-size: .72em; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 4px; }
      .sum-row { display: flex; gap: 8px; align-items: baseline; font-size: .85em; padding: 2px 0; }
      .sum-row .s-name { font-weight: 600; }
      .sum-row .s-lvl { margin-left: auto; font-weight: 600; }
      .forecast { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; }
      .day { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 48px; flex: 1; cursor: pointer; border-radius: 8px; padding: 3px 0; }
      .day.selected { background: var(--secondary-background-color, rgba(128,128,128,.14)); }
      .d-name { font-size: .7em; color: var(--secondary-text-color); }
      .d-dot { width: 14px; height: 14px; border-radius: 50%; }
      .d-level { font-size: .65em; font-weight: 600; }
      .extras { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 10px; }
      .extra { display: flex; gap: 6px; align-items: center; font-size: .85rem; }
      .e-dot { width: 10px; height: 10px; border-radius: 50%; }
      .e-name { font-weight: 600; }
      .e-level { font-weight: 600; }
      .empty { padding: 16px; color: var(--secondary-text-color); }
    `;
  }
}

// Compact form of the site's "16 ottobre alle ore 12:11" -> "16/10 12:11".
function _fmtAggiornamento(value) {
  if (!value) return "";
  const m = String(value).match(
    /(\d{1,2})\s+([a-zàèéìòù]+)\s+alle\s+ore\s+(\d{1,2}):(\d{2})/i
  );
  if (m) {
    const mo = IT_MONTHS[m[2].toLowerCase()];
    if (mo) {
      return `${m[1].padStart(2, "0")}/${String(mo).padStart(2, "0")} ${m[3].padStart(2, "0")}:${m[4]}`;
    }
  }
  return value;
}

const EDITOR_TAG = "ha-pollini-card-editor";

const EDITOR_LABELS = {
  entity: "Entità principale",
  title: "Titolo (opzionale)",
  entities: "Altre famiglie (opzionale)",
  show_subs: "Mostra le sottospecie",
  show_forecast: "Mostra le previsioni",
  show_badge_name: "Mostra il nome nello stato",
  forecast_days: "Giorni di previsione da mostrare",
  font_size: "Dimensione del testo",
};

class HaPolliniCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._form = null;
  }

  setConfig(config) {
    this._config = { ...HaPolliniCardEditor._defaults(), ...(config || {}) };
    this._render();
  }

  static _defaults() {
    return {
      show_subs: true,
      show_forecast: true,
      show_badge_name: true,
      forecast_days: 7,
      font_size: "normal",
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = ev.detail.value;
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.shadowRoot.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      {
        name: "entity",
        required: true,
        selector: { entity: { domain: "sensor", integration: "ha_pollini" } },
      },
      { name: "title", selector: { text: {} } },
      {
        name: "entities",
        selector: {
          entity: { domain: "sensor", integration: "ha_pollini", multiple: true },
        },
      },
      { name: "show_subs", selector: { boolean: {} } },
      { name: "show_forecast", selector: { boolean: {} } },
      { name: "show_badge_name", selector: { boolean: {} } },
      {
        name: "forecast_days",
        selector: { number: { min: 1, max: 7, mode: "box", step: 1 } },
      },
      {
        name: "font_size",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "small", label: "Piccolo" },
              { value: "normal", label: "Normale" },
              { value: "large", label: "Grande" },
              { value: "xlarge", label: "Molto grande" },
            ],
          },
        },
      },
    ];
    this._form.computeLabel = (schema) => EDITOR_LABELS[schema.name] || schema.name;
  }
}

const CARD_TAG = "ha-pollini-card";

const defineCard = () => {
  for (const [tag, cls] of [
    [CARD_TAG, HaPolliniCard],
    [EDITOR_TAG, HaPolliniCardEditor],
  ]) {
    try {
      if (!customElements.get(tag)) {
        customElements.define(tag, cls);
      }
    } catch (_err) {
      // Already registered in this registry.
    }
  }
};

// Home Assistant replaces window.customElements with a scoped registry while
// booting, after modules loaded via frontend.add_extra_js_url() may already
// have run. An element defined on the previous registry is not visible on the
// new one, which makes the card disappear from the card picker and the
// dashboard. Register now and again once the swap is observed.
const initialRegistry = globalThis.customElements;
defineCard();
if (globalThis.customElements === initialRegistry) {
  const swapWatcher = window.setInterval(() => {
    if (globalThis.customElements === initialRegistry) return;
    window.clearInterval(swapWatcher);
    defineCard();
  }, 200);
  window.setTimeout(() => window.clearInterval(swapWatcher), 30000);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "3BMeteo Pollini",
  description: "Livello pollini, sottospecie e previsioni 7 giorni",
  version: CARD_VERSION,
  preview: false,
});
