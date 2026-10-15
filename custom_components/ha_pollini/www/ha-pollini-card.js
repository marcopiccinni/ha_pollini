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
const LEVEL_ORDER = ["Assente", "Basso", "Medio", "Alto"];

const CARD_VERSION = "0.1.0";

class HaPolliniCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("È richiesto 'entity' (un sensore ha_pollini).");
    }
    this._config = { show_subs: true, ...config };
    if (this._hass) this._render();
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
      (e) => e.startsWith("sensor.") && hass.states[e].attributes.livello !== undefined
    );
    return { entity: entity || "sensor.pollini_esempio_composite" };
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
    const level = attrs.livello || stateObj.state || "";
    const name = attrs.nome || attrs.famiglia || "";
    const subs = attrs.sottospecie || [];
    const forecast = attrs.previsioni || [];
    const extras = (this._config.entities || [])
      .map((id) => this._state(id))
      .filter(Boolean);

    this.shadowRoot.innerHTML = `
      <style>${HaPolliniCard._css()}</style>
      <ha-card>
        <div class="content">
          <div class="header">
            <span class="title">${title}</span>
            <span class="updated">${attrs.aggiornamento ? "Agg. " + attrs.aggiornamento : (attrs.provincia || "")}</span>
          </div>
          ${this._badge(level, name)}
          ${this._config.show_subs && subs.length ? this._subs(subs) : ""}
          ${this._forecast(forecast)}
          ${extras.length ? this._extras(extras) : ""}
        </div>
      </ha-card>`;
  }

  _badge(level, name) {
    const color = LEVEL_COLORS[level] || "#999";
    const dots = LEVEL_ORDER.map((n, i) => {
      const active = i <= LEVEL_ORDER.indexOf(level);
      const c = active ? LEVEL_COLORS[n] : "var(--divider-color, #ddd)";
      return `<span class="dot" style="background:${c}"></span>`;
    }).join("");
    return `
      <div class="badge">
        <div class="badge-level" style="background:${color}">
          <span class="bl-name">${name}</span>
          <span class="bl-value">${level || "—"}</span>
        </div>
        <div class="dots">${dots}</div>
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

  _forecast(forecast) {
    if (!forecast.length) return "";
    const items = forecast
      .map((d) => {
        const color = LEVEL_COLORS[d.livello] || "#999";
        return `<div class="day">
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
      .badge-level { display: flex; flex-direction: column; align-items: center; border-radius: 12px; padding: 12px 28px; color: #fff; min-width: 50%; }
      .bl-name { font-size: .8rem; opacity: .9; }
      .bl-value { font-size: 1.6rem; font-weight: 700; }
      .dots { display: flex; gap: 6px; }
      .dot { width: 12px; height: 12px; border-radius: 50%; }
      .subs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .sub { display: flex; gap: 6px; align-items: baseline; font-size: .85rem; background: var(--secondary-background-color, #f4f4f4); border-radius: 8px; padding: 3px 8px; }
      .s-name { color: var(--primary-text-color); }
      .s-level { font-weight: 600; }
      .forecast { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; }
      .day { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 48px; flex: 1; }
      .d-name { font-size: .7rem; color: var(--secondary-text-color); }
      .d-dot { width: 14px; height: 14px; border-radius: 50%; }
      .d-level { font-size: .65rem; font-weight: 600; }
      .extras { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 10px; }
      .extra { display: flex; gap: 6px; align-items: center; font-size: .85rem; }
      .e-dot { width: 10px; height: 10px; border-radius: 50%; }
      .e-name { font-weight: 600; }
      .e-level { font-weight: 600; }
      .empty { padding: 16px; color: var(--secondary-text-color); }
    `;
  }
}

customElements.define("ha-pollini-card", HaPolliniCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-pollini-card",
  name: "3BMeteo Pollini",
  description: "Livello pollini, sottospecie e previsioni 7 giorni",
  version: CARD_VERSION,
  preview: false,
});
